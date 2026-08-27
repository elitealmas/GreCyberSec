export function CourseProgress({ completed, total }: { completed: number; total: number }) {
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return <div className="course-progress"><div className="flex items-center justify-between gap-4 text-sm"><span>{completed} / {total} lessons</span><strong className="text-[#20ff62]">{percentage}%</strong></div><progress value={completed} max={Math.max(total, 1)} aria-label={`${percentage}% course completion`}>{percentage}%</progress></div>;
}
