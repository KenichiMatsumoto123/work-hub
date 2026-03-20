import { Input } from '~/components/ui/Input'
import { Button } from '~/components/ui/Button'
import type { Task } from '~/lib/types'

interface TaskRowProps {
  task: Task
  onChange: (task: Task) => void
  onRemove: () => void
  canRemove: boolean
}

export function TaskRow({ task, onChange, onRemove, canRemove }: TaskRowProps) {
  const up = (field: keyof Task, val: string) => onChange({ ...task, [field]: val })

  return (
    <div className="flex gap-1.5 items-center flex-wrap">
      <Input
        placeholder="ラベル (例: HNC)"
        value={task.label}
        onChange={(e) => up('label', e.target.value)}
        className="!w-[90px] flex-[0_0_90px]"
      />
      <Input
        placeholder="タスク名"
        value={task.name}
        onChange={(e) => up('name', e.target.value)}
        className="flex-[1_1_140px] min-w-[120px]"
      />
      <div className="flex gap-1 items-center">
        <Input
          sizeVariant="small"
          placeholder="予定h"
          value={task.plannedHours}
          onChange={(e) => up('plannedHours', e.target.value)}
        />
        <span className="text-text-muted text-xs">→</span>
        <Input
          sizeVariant="small"
          placeholder="実績h"
          value={task.actualHours}
          onChange={(e) => up('actualHours', e.target.value)}
        />
      </div>
      <div className="flex gap-1 items-center">
        <Input
          sizeVariant="small"
          placeholder="前%"
          value={task.progressBefore}
          onChange={(e) => up('progressBefore', e.target.value)}
          className="!w-[46px]"
        />
        <Input
          sizeVariant="small"
          placeholder="見%"
          value={task.progressExpected}
          onChange={(e) => up('progressExpected', e.target.value)}
          className="!w-[46px]"
        />
        <Input
          sizeVariant="small"
          placeholder="実%"
          value={task.progressActual}
          onChange={(e) => up('progressActual', e.target.value)}
          className="!w-[46px]"
        />
      </div>
      {canRemove && (
        <Button variant="danger" onClick={onRemove} title="削除" className="!px-2 !py-1 text-sm">
          ×
        </Button>
      )}
    </div>
  )
}
