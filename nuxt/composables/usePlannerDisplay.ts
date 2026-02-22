import { computed, nextTick } from 'vue'
import type { Ref, ComputedRef, WritableComputedRef } from 'vue'
import { isFilled } from '~/utils/plannerHelpers'
import { planVariants } from '~/utils/plannerVariants'
import type { Plan, PlannedSession, PlanVariantId } from '~/utils/plannerTypes'
import type { Athlete, Row, RestBaseline } from '~/stores/athletes'
import type { MvpPreview, MvpLoad5Set } from '~/stores/mvp'
import type { MvpKey } from '~/composables/usePlannerMvp'

import PlannerPeriodCard from '~/components/planner/cards/PlannerPeriodCard.vue'
import PlannerDataCard from '~/components/planner/cards/PlannerDataCard.vue'
import PlannerBaselineCard from '~/components/planner/cards/PlannerBaselineCard.vue'
import PlannerModelingCard from '~/components/planner/cards/PlannerModelingCard.vue'
import PlannerMvpScalesCard from '~/components/planner/mvp/PlannerMvpScalesCard.vue'
import PlannerMvpRestCard from '~/components/planner/mvp/PlannerMvpRestCard.vue'
import PlannerMvpAfterLoadCard from '~/components/planner/mvp/PlannerMvpAfterLoadCard.vue'
import PlannerMvpLoadCard from '~/components/planner/mvp/PlannerMvpLoadCard.vue'

export interface PlannerDisplayDeps {
  // From Group 1
  athletes: Ref<Athlete[]>
  activeAthleteId: Ref<string>
  athleteCountModel: WritableComputedRef<number>
  setActiveAthlete: (id: string) => void
  deleteAthlete: (id: string) => void
  getRow: (athlete: Athlete, w: number, s: number) => Row
  fillDemo: () => void
  resetAll: () => void
  activeRestBaseline: ComputedRef<RestBaseline>
  getPlanWeeksFor: (athlete: Athlete) => number
  // From Group 2
  canModel: ComputedRef<boolean>
  hasFilledData: ComputedRef<boolean>
  flatPlan: ComputedRef<PlannedSession[]>
  model: () => Promise<void>
  // Shared state
  athletePlans: Ref<Record<string, Partial<Record<PlanVariantId, Plan>>>>
  activePlanId: Ref<PlanVariantId>
  activePlan: ComputedRef<Plan | null>
  competitionDate: ComputedRef<string>
  startDate: ComputedRef<string>
  drawCharts: () => void
  getPngDataUrls: () => { V: string; P: string; R: string }
  // MVP deps
  mvp: {
    mvpFiles: { scale2: MvpPreview | null; scale5: MvpPreview | null; rest2: MvpPreview[] }
    handleMvpFileChange: (event: Event, key: MvpKey) => void
    removeMvpFile: (key: MvpKey, id?: string) => void
    load5Sets: Ref<MvpLoad5Set[]>
    addLoad5Set: () => void
    removeLoad5Set: (setId: string) => void
    handleLoad5SetFileChange: (event: Event, setId: string, field: string) => void
    removeLoad5SetFile: (setId: string, field: string) => void
  }
}

export function usePlannerDisplay(deps: PlannerDisplayDeps) {
  // ─── Computed ───
  const activeVariant = computed(
    () => planVariants.find((v) => v.id === deps.activePlanId.value) ?? null
  )

  const uiFormCards = computed(() => [
    {
      key: 'period',
      title: 'Период',
      subtitle: 'Наблюдение и план до даты старта',
      component: PlannerPeriodCard,
      componentProps: {
        athletes: deps.athletes.value,
        activeAthleteId: deps.activeAthleteId.value,
        athleteCountModel: deps.athleteCountModel,
        setActiveAthlete: deps.setActiveAthlete,
        deleteAthlete: deps.deleteAthlete,
        getPlanWeeksFor: deps.getPlanWeeksFor,
      },
    },
    {
      key: 'data',
      title: 'Данные',
      subtitle: 'База для моделирования',
      component: PlannerDataCard,
      componentProps: {
        fillDemo: deps.fillDemo,
        resetAll: deps.resetAll,
      },
    },
    {
      key: 'baseline',
      title: 'Покой (baseline)',
      subtitle: 'Y0 — проба без нагрузки',
      component: PlannerBaselineCard,
      componentProps: {
        activeRestBaseline: deps.activeRestBaseline.value,
      },
    },
    {
      key: 'modeling',
      title: 'Моделирование',
      subtitle: 'Кнопка запуска',
      component: PlannerModelingCard,
      componentProps: {
        canModel: deps.canModel.value,
        model: deps.model,
        exportPdf,
        activePlan: deps.activePlan.value,
        competitionDate: deps.competitionDate.value,
        hasFilledData: deps.hasFilledData.value,
        activeVariant: activeVariant.value,
        flatPlan: deps.flatPlan.value,
        planVariants,
        activePlanId: deps.activePlanId.value,
        selectPlan,
      },
    },
  ])

  const mvpCards = computed(() => [
    {
      key: 'mvp-scales',
      title: 'Эталоны (шкалы)',
      subtitle: 'Фотографии эталонных шкал',
      component: PlannerMvpScalesCard,
      componentProps: {
        files: deps.mvp.mvpFiles,
        onFileChange: deps.mvp.handleMvpFileChange,
        remove: deps.mvp.removeMvpFile,
      },
    },
    {
      key: 'mvp-rest',
      title: 'Покой',
      subtitle: 'Полоски в состоянии покоя',
      component: PlannerMvpRestCard,
      componentProps: {
        files: deps.mvp.mvpFiles,
        onFileChange: deps.mvp.handleMvpFileChange,
        remove: deps.mvp.removeMvpFile,
      },
    },
    {
      key: 'mvp-after',
      title: 'После нагрузки',
      subtitle: 'Фото полосок после тренировки',
      component: PlannerMvpAfterLoadCard,
      componentProps: {
        load5Sets: deps.mvp.load5Sets.value,
        addSet: deps.mvp.addLoad5Set,
        removeSet: deps.mvp.removeLoad5Set,
        onSetFileChange: deps.mvp.handleLoad5SetFileChange,
        removeSetFile: deps.mvp.removeLoad5SetFile,
      },
    },
    {
      key: 'mvp-load',
      title: 'Нагрузка',
      subtitle: 'Фото/текст контекста',
      component: PlannerMvpLoadCard,
      componentProps: {
        load5Sets: deps.mvp.load5Sets.value,
        onSetFileChange: deps.mvp.handleLoad5SetFileChange,
        removeSetFile: deps.mvp.removeLoad5SetFile,
      },
    },
  ])

  // ─── Functions ───
  const chipText = (r: Row): string => (isFilled(r) ? 'База' : '—')

  const chipClass = (r: Row): string =>
    isFilled(r)
      ? 'bg-emerald-50 border border-emerald-100 text-emerald-800'
      : 'bg-slate-50 border border-slate-200 text-slate-600'

  const summaryWeek = (athlete: Athlete, w: number): string => {
    const filled = Array.from(
      { length: athlete.period.sessionsPerWeek },
      (_, i) => deps.getRow(athlete, w, i + 1)
    ).filter(isFilled).length
    return `Заполнено ${filled}/${athlete.period.sessionsPerWeek}`
  }

  const selectPlan = async (id: PlanVariantId) => {
    deps.activePlanId.value = id
    await nextTick()
    deps.drawCharts()
  }

  const statusChip = (t: PlannedSession): string =>
    t.flag === 'OK'
      ? 'bg-emerald-50 border border-emerald-100 text-emerald-800'
      : 'bg-amber-50 border border-amber-100 text-amber-800'

  const weekDates = (weekIndexZero: number): string => {
    if (!deps.startDate.value) return ''
    const start = new Date(deps.startDate.value)
    const a = new Date(start)
    a.setDate(a.getDate() + weekIndexZero * 7)
    const b = new Date(a)
    b.setDate(b.getDate() + 6)
    const fmt = (d: Date) =>
      d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    return `${fmt(a)}–${fmt(b)}`
  }

  const exportPdf = async () => {
    if (!deps.activePlan.value) return
    const chartPngDataUrls = deps.getPngDataUrls()

    const planText = deps.activePlan.value.weeks
      .map((w) => {
        const head = `Неделя ${w.week} — ${w.model}`
        const sessions = w.sessions
          .map((t) =>
            [
              `  Тренировка ${t.session}: V=${t.V} кг, P=${t.P}, R=${t.R} мин`,
              `  ${t.workout.replace(/\n/g, '\n  ')}`,
            ].join('\n')
          )
          .join('\n\n')
        return `${head}\n${sessions}`
      })
      .join('\n\n' + '-'.repeat(40) + '\n\n')

    const subtitle = deps.competitionDate.value
      ? `Дата соревнований: ${deps.competitionDate.value} · ${
          activeVariant.value?.title ?? ''
        }`.trim()
      : `Сформировано: ${new Date(deps.activePlan.value.createdAt).toLocaleString(
          'ru-RU'
        )} · ${activeVariant.value?.title ?? ''}`.trim()

    const blob = await $fetch<Blob>('/api/pdf', {
      method: 'POST',
      body: {
        title: 'Тренировочный план (микроциклы)',
        subtitle,
        planText,
        chartPngDataUrls,
      },
      responseType: 'blob',
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'training-plan.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    // computed
    activeVariant,
    uiFormCards,
    mvpCards,
    // functions
    chipText,
    chipClass,
    summaryWeek,
    selectPlan,
    statusChip,
    weekDates,
    exportPdf,
  }
}
