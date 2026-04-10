import { buildTaskBriefing } from "@/lib/taskDescription";
import { cn } from "@/lib/utils";

interface TaskBriefingViewProps {
  description?: string;
  className?: string;
}

export default function TaskBriefingView({ description, className }: TaskBriefingViewProps) {
  const briefing = buildTaskBriefing(description);

  if (briefing.intro.length === 0 && briefing.sections.length === 0) {
    return <p className={cn("saas-task-preview-empty", className)}>No task description provided.</p>;
  }

  return (
    <div className={cn("saas-task-briefing", className)}>
      {briefing.intro.length > 0 && (
        <div className="saas-task-briefing-intro">
          {briefing.intro.map((line, index) => (
            <p key={`intro-${index}`} className="saas-task-preview-paragraph">
              {line}
            </p>
          ))}
        </div>
      )}

      {briefing.sections.map((section, sectionIndex) => (
        <section key={`section-${sectionIndex}`} className="saas-task-briefing-section">
          <h4 className="saas-task-briefing-title">{section.title}</h4>
          {section.points.length > 0 && (
            <ul className="saas-task-preview-list">
              {section.points.map((point, pointIndex) => (
                <li key={`section-${sectionIndex}-point-${pointIndex}`} className="saas-task-preview-paragraph">
                  {point}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

