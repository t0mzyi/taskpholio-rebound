import api from "@/lib/api";
import { Attachment } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const AVATAR_MAX_SIZE = 5 * 1024 * 1024;
const ASSET_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_ASSET_BUCKET || "task-assets";
const AVATAR_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || "avatars";

type UploadOptions = {
  imageOnly?: boolean;
  maxSizeBytes?: number;
};

export type UploadFailure = {
  fileName: string;
  reason: string;
};

export type UploadResult = {
  uploaded: Attachment[];
  failed: UploadFailure[];
};

const errorMessageFromUnknown = (error: unknown): string => {
  if (!error) return "Upload failed.";
  if (typeof error === "string") return error;

  const anyError = error as any;
  if (anyError?.response?.data?.message) return String(anyError.response.data.message);
  if (anyError?.response?.data?.error) return String(anyError.response.data.error);
  if (anyError?.message) return String(anyError.message);
  return "Upload failed.";
};

const normalizeAttachment = (payload: any, file: File): Attachment => ({
  fileName: payload?.fileName || file.name,
  fileUrl: payload?.fileUrl || "",
  fileType: payload?.fileType || file.type || "application/octet-stream",
  uploadedAt: new Date().toISOString(),
});

const validateFile = (file: File, options?: UploadOptions): string | null => {
  const sizeLimit = options?.maxSizeBytes || (options?.imageOnly ? AVATAR_MAX_SIZE : MAX_FILE_SIZE);
  if (file.size > sizeLimit) {
    return `File is too large (max ${Math.round(sizeLimit / 1024 / 1024)}MB).`;
  }

  if (options?.imageOnly && !file.type.startsWith("image/")) {
    return "Only image files are allowed.";
  }

  return null;
};

const sanitizeFileName = (input: string): string =>
  input.replace(/[^\w.\-]/g, "_").replace(/_+/g, "_");

const uploadViaApi = async (file: File): Promise<Attachment> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/upload/single", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 45000,
  });

  if (!response?.data?.success || !response?.data?.data?.fileUrl) {
    throw new Error(response?.data?.message || "Upload service returned an invalid response.");
  }

  return normalizeAttachment(response.data.data, file);
};

const uploadViaSupabase = async (file: File, options?: UploadOptions): Promise<Attachment> => {
  const bucket = options?.imageOnly ? AVATAR_BUCKET : ASSET_BUCKET;
  const folder = options?.imageOnly ? "profile" : "attachments";
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id || "anonymous";
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name)}`;
  const objectPath = `${folder}/${userId}/${extension ? uniqueName : `${uniqueName}.bin`}`;

  const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (error) {
    throw new Error(error.message || `Failed to upload file to ${bucket}.`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!data?.publicUrl) {
    throw new Error("Upload succeeded but file URL could not be generated.");
  }

  return normalizeAttachment(
    {
      fileName: file.name,
      fileUrl: data.publicUrl,
      fileType: file.type || "application/octet-stream",
    },
    file
  );
};

export const uploadAttachments = async (
  filesInput: FileList | File[] | null | undefined,
  options?: UploadOptions
): Promise<UploadResult> => {
  const files = Array.from(filesInput || []);
  const uploaded: Attachment[] = [];
  const failed: UploadFailure[] = [];

  for (const file of files) {
    const validationError = validateFile(file, options);
    if (validationError) {
      failed.push({ fileName: file.name, reason: validationError });
      continue;
    }

    try {
      try {
        uploaded.push(await uploadViaApi(file));
        continue;
      } catch (apiError) {
        uploaded.push(await uploadViaSupabase(file, options));
        continue;
      }
    } catch (error: any) {
      failed.push({
        fileName: file.name,
        reason: errorMessageFromUnknown(error),
      });
    }
  }

  return { uploaded, failed };
};
