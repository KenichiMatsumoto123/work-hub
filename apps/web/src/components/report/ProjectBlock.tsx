import { Input } from '~/components/ui/Input'
import { Button } from '~/components/ui/Button'
import { Label } from '~/components/ui/Label'
import { TaskRow } from './TaskRow'
import { defaultTask } from '~/lib/defaults'
import type { Project, Task } from '~/lib/types'

interface ProjectBlockProps {
  project: Project
  onChange: (project: Project) => void
  onRemove: () => void
  canRemove: boolean
}

export function ProjectBlock({ project, onChange, onRemove, canRemove }: ProjectBlockProps) {
  const up = (field: string, val: unknown) => onChange({ ...project, [field]: val })
  const updateTask = (idx: number, task: Task) => {
    const ts = [...project.tasks]
    ts[idx] = task
    up('tasks', ts)
  }
  const removeTask = (idx: number) =>
    up(
      'tasks',
      project.tasks.filter((_, i) => i !== idx)
    )
  const addTask = () => up('tasks', [...project.tasks, defaultTask()])

  const totalPlanned = project.tasks.reduce((s, t) => s + (parseFloat(t.plannedHours) || 0), 0)
  const totalActual = project.tasks.reduce((s, t) => s + (parseFloat(t.actualHours) || 0), 0)

  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2.5">
      <div className="flex gap-2 items-center">
        <span className="text-accent font-bold text-base">■</span>
        <Input
          placeholder="プロジェクト名 (例: Hexabase)"
          value={project.name}
          onChange={(e) => up('name', e.target.value)}
          className="flex-1 !font-semibold !text-sm"
        />
        <span className="text-xs text-text-dim whitespace-nowrap">
          {totalPlanned}h → {totalActual}h
        </span>
        {canRemove && (
          <Button variant="danger" onClick={onRemove} title="プロジェクト削除">
            ×
          </Button>
        )}
      </div>
      <div className="flex gap-1 pl-6 flex-wrap">
        <Label className="w-[90px] flex-[0_0_90px]">ラベル</Label>
        <Label className="flex-[1_1_140px]">タスク名</Label>
        <Label className="w-[130px]">予定→実績(h)</Label>
        <Label className="w-[150px]">進捗 前/見/実(%)</Label>
      </div>
      <div className="flex flex-col gap-1.5 pl-6">
        {project.tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            onChange={(t) => updateTask(i, t)}
            onRemove={() => removeTask(i)}
            canRemove={project.tasks.length > 1}
          />
        ))}
      </div>
      <div className="pl-6">
        <Button variant="ghost" onClick={addTask}>
          + タスク追加
        </Button>
      </div>
    </div>
  )
}
