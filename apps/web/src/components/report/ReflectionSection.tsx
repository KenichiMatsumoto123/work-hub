import { Label } from '~/components/ui/Label'

interface ReflectionSectionProps {
  goodPoints: string
  setGoodPoints: (v: string) => void
  badPoints: string
  setBadPoints: (v: string) => void
  nextPlan: string
  setNextPlan: (v: string) => void
}

const taClass =
  'bg-bg border border-border rounded-md text-text font-sans text-[13px] px-2.5 py-2 w-full resize-y min-h-[60px]'

export function ReflectionSection({
  goodPoints,
  setGoodPoints,
  badPoints,
  setBadPoints,
  nextPlan,
  setNextPlan,
}: ReflectionSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label className="!text-success">＜よかった点＞</Label>
        <textarea
          className={taClass}
          value={goodPoints}
          onChange={(e) => setGoodPoints(e.target.value)}
          placeholder={'【プロジェクト名】タスク名\n→コメント'}
          rows={3}
        />
      </div>
      <div>
        <Label className="!text-warn">＜課題点＞</Label>
        <textarea
          className={taClass}
          value={badPoints}
          onChange={(e) => setBadPoints(e.target.value)}
          placeholder={'【プロジェクト名】タスク名\n→コメント'}
          rows={3}
        />
      </div>
      <div>
        <Label className="!text-accent">＜次回の稼働予定＞</Label>
        <textarea
          className={taClass}
          value={nextPlan}
          onChange={(e) => setNextPlan(e.target.value)}
          placeholder="【プロジェクト名】タスク名(見込時間)"
          rows={2}
        />
      </div>
    </div>
  )
}
