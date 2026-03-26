-- Allow users to permanently clear their own notifications.

drop policy if exists "notif_delete" on public.notifications;

create policy "notif_delete"
on public.notifications
for delete
using (user_id = auth.uid());
