<template>
  <div class="space-y-6">
    <section class="flex flex-col gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight">Моделирование микроциклов</h1>
        <p class="text-slate-700 mt-2">
          Вводите параметры нагрузки (V/P/R) и маркеры, затем нажимайте <b>«Получить модель тренировочного плана»</b>.
          Приложение построит недельные микроциклы, покажет план, график динамики и позволит экспортировать результат в PDF.
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mobile-cards-vertical">
        <UiCard title="Период" subtitle="Наблюдение и план до даты старта">
          <div class="grid grid-cols-2 gap-3">
            <Field label="Недели наблюдения">
              <input v-model.number="observationWeeks" type="number" min="1" max="52" class="input" />
            </Field>
            <Field label="Тренировок/нед">
              <input v-model.number="sessionsPerWeek" type="number" min="1" max="10" class="input" />
            </Field>
          </div>
          <div class="mt-3">
            <div class="grid grid-cols-2 gap-3">
              <Field label="Дата начала плана">
                <input v-model="startDate" type="date" class="input" />
              </Field>
              <Field label="Недель до старта">
                <input :value="planWeeks" type="number" class="input" disabled />
              </Field>
            </div>
            <Field label="Дата соревнований">
              <input v-model="competitionDate" type="date" class="input" />
            </Field>
            <div class="text-xs text-slate-600 mt-2">
              План формируется <b>до даты соревнований</b> (от даты начала плана).
              «Недели наблюдения» — это период, в котором вы вводите данные заборов биоматериала (база для регрессии).
            </div>
          </div>
        </UiCard>

        <UiCard title="Данные" subtitle="База для моделирования">
          <div class="text-sm text-slate-700">
            Заполните хотя бы 1 неделю — по средним значениям будет построена базовая нагрузка, от которой рассчитываются микроциклы.
          </div>
          <div class="mt-3 flex flex-col gap-2">
            <button class="h-10 px-3 rounded-xl bg-slate-100 text-slate-900 font-medium hover:bg-slate-200" @click="fillDemo">
              Загрузить демоданные
            </button>
            <button class="h-10 px-3 rounded-xl border font-medium hover:bg-slate-50" @click="resetAll">
              Сбросить ввод
            </button>
          </div>
        </UiCard>

        <UiCard title="Покой (baseline)" subtitle="Y0 — проба без нагрузки">
          <div class="text-sm text-slate-700">
            Если есть проба в покое, модель строится для
            <b>Z = ln(Y / Y0)</b>, а прогноз возвращается как <b>Ŷ = Y0 · exp(Ẑ)</b>.
          </div>
          <div class="mt-3 grid grid-cols-3 gap-3">
            <Field label="Креатинин Y0">
              <input v-model.number="restBaseline.creatinine" type="number" step="0.1" class="input" />
            </Field>
            <Field label="Белок Y0">
              <input v-model.number="restBaseline.protein" type="number" step="0.1" class="input" />
            </Field>
            <Field label="Миоглобин Y0">
              <input v-model.number="restBaseline.myoglobin" type="number" step="0.1" class="input" />
            </Field>
          </div>
          <div class="text-xs text-slate-600 mt-2">
            Если Y0 не заполнен, будет использована внутренняя подстановка (менее предпочтительно).
          </div>
        </UiCard>

        <UiCard title="Моделирование" subtitle="Кнопка запуска">
          <div class="flex flex-col gap-2">
            <button
              :disabled="!canModel"
              class="h-10 px-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="model"
            >
              Получить 5 вариантов тренировочного плана
            </button>
            <button :disabled="!activePlan" class="h-10 px-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 disabled:opacity-50" @click="exportPdf">
              Скачать PDF (выбранный план + график)
            </button>
          </div>
          <div v-if="!canModel" class="mt-3 text-xs text-slate-600 space-y-1">
            <div v-if="!competitionDate">
              Укажите <b>дату соревнований</b>, чтобы активировать расчёт.
            </div>
            <div v-else-if="!hasFilledData">
              <b>Заполните данные по неделям</b> (хотя бы одну тренировку: V, P, R) в разделе "Ввод данных по неделям" ниже.
            </div>
          </div>
          <div v-if="activePlan" class="mt-3 text-xs text-slate-600 space-y-2">
            <div>
              Вариант: <b>{{ activeVariant?.title }}</b> · недель: <b>{{ activePlan.weeks.length }}</b> · тренировок: <b>{{ flatPlan.length }}</b>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button
                v-for="v in planVariants"
                :key="v.id"
                class="px-3 py-2 rounded-xl border text-sm hover:bg-slate-50"
                :class="activePlanId === v.id ? 'bg-slate-100 border-slate-200' : ''"
                @click="selectPlan(v.id)"
              >
                {{ v.title }}
              </button>
            </div>
          </div>
        </UiCard>

        <UiCard title="Контент" subtitle="Obsidian страницы">
          <div class="text-sm text-slate-700">
            Описание маркеров и моделей хранится в Obsidian:
          </div>
          <div class="mt-3 flex gap-2 flex-wrap">
            <NuxtLink class="px-3 py-2 rounded-xl border hover:bg-slate-50 text-sm" to="/markers">Маркеры</NuxtLink>
            <NuxtLink class="px-3 py-2 rounded-xl border hover:bg-slate-50 text-sm" to="/models">Модели</NuxtLink>
            <NuxtLink class="px-3 py-2 rounded-xl border hover:bg-slate-50 text-sm" to="/regression">Логарифмическая регрессия</NuxtLink>
            <NuxtLink class="px-3 py-2 rounded-xl border hover:bg-slate-50 text-sm" to="/algorithm">Алгоритм размышлений</NuxtLink>
          </div>
        </UiCard>
      </div>
    </section>

    <section class="grid gap-6">
      <div>
        <UiCard title="Ввод данных по неделям" subtitle="Каждая тренировка: V, P, R и маркеры">
          <div class="space-y-4">
            <details
              v-for="w in observationWeeks"
              :key="w"
              class="rounded-2xl border bg-white p-4"
              :open="expandedWeeks.includes(w)"
            >
              <summary class="cursor-pointer select-none flex items-center justify-between gap-3">
                <div class="font-semibold">Неделя {{ w }}</div>
                <div class="text-xs text-slate-600">{{ summaryWeek(w) }}</div>
              </summary>

              <div class="mt-4 space-y-3">
                <!-- Mobile cards -->
                <div class="grid gap-3 lg:hidden">
                  <div v-for="s in sessionsPerWeek" :key="`${w}-${s}`" class="rounded-2xl border p-4">
                    <div class="flex items-center justify-between">
                      <div class="font-medium">Тренировка {{ s }}</div>
                      <span class="text-xs px-2 py-1 rounded-full" :class="chipClass(getRow(w,s))">{{ chipText(getRow(w,s)) }}</span>
                    </div>
                    <div class="mt-3 grid grid-cols-2 gap-3">
                      <Field label="V (кг)"><input v-model.number="rows[keyOf(w,s)].V" type="number" class="input" /></Field>
                      <Field label="P (раз)"><input v-model.number="rows[keyOf(w,s)].P" type="number" class="input" /></Field>
                      <Field label="R (мин)"><input v-model.number="rows[keyOf(w,s)].R" type="number" step="0.1" class="input" /></Field>
                      <div class="rounded-xl bg-slate-50 border p-3">
                        <div class="text-xs text-slate-600">Подсказка</div>
                        <div class="text-sm text-slate-700 mt-1">P↑ = средний вес↓; P↓ = средний вес↑</div>
                      </div>
                    </div>
                    <div class="mt-3 grid grid-cols-3 gap-3">
                      <Field label="Креатинин"><input v-model.number="rows[keyOf(w,s)].creatinine" type="number" step="0.1" class="input" /></Field>
                      <Field label="Белок"><input v-model.number="rows[keyOf(w,s)].protein" type="number" step="0.1" class="input" /></Field>
                      <Field label="Миоглобин"><input v-model.number="rows[keyOf(w,s)].myoglobin" type="number" step="0.1" class="input" /></Field>
                    </div>
                  </div>
                </div>

                <!-- Desktop table -->
                <div class="hidden lg:block overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left text-slate-600">
                        <th class="py-2 pr-3">Трен.</th>
                        <th class="py-2 pr-3">V</th>
                        <th class="py-2 pr-3">P</th>
                        <th class="py-2 pr-3">R</th>
                        <th class="py-2 pr-3">Креатинин</th>
                        <th class="py-2 pr-3">Белок</th>
                        <th class="py-2 pr-3">Миоглобин</th>
                        <th class="py-2">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="s in sessionsPerWeek" :key="`${w}-${s}`" class="border-t">
                        <td class="py-3 pr-3 font-medium">{{ s }}</td>
                        <td class="py-3 pr-3"><input v-model.number="rows[keyOf(w,s)].V" type="number" class="input h-10 w-28" /></td>
                        <td class="py-3 pr-3"><input v-model.number="rows[keyOf(w,s)].P" type="number" class="input h-10 w-24" /></td>
                        <td class="py-3 pr-3"><input v-model.number="rows[keyOf(w,s)].R" type="number" step="0.1" class="input h-10 w-24" /></td>
                        <td class="py-3 pr-3"><input v-model.number="rows[keyOf(w,s)].creatinine" type="number" step="0.1" class="input h-10 w-28" /></td>
                        <td class="py-3 pr-3"><input v-model.number="rows[keyOf(w,s)].protein" type="number" step="0.1" class="input h-10 w-24" /></td>
                        <td class="py-3 pr-3"><input v-model.number="rows[keyOf(w,s)].myoglobin" type="number" step="0.1" class="input h-10 w-28" /></td>
                        <td class="py-3">
                          <span class="text-xs px-2 py-1 rounded-full" :class="chipClass(getRow(w,s))">{{ chipText(getRow(w,s)) }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          </div>
        </UiCard>
      </div>

      <div class="space-y-6 w-full">
        <div class="grid gap-6 lg:grid-cols-3">
          <UiCard title="Динамика объёма" subtitle="V (кг) по всем тренировкам">
            <div v-if="!activePlan" class="text-slate-600 text-sm">Сначала получите варианты тренировочного плана.</div>
            <div v-else class="relative h-64 max-h-64 w-full">
              <canvas ref="chartVEl" class="absolute inset-0 w-full h-full" />
            </div>
          </UiCard>

          <UiCard title="Динамика подъёмов" subtitle="P (раз) по всем тренировкам">
            <div v-if="!activePlan" class="text-slate-600 text-sm">Сначала получите варианты тренировочного плана.</div>
            <div v-else class="relative h-64 max-h-64 w-full">
              <canvas ref="chartPEl" class="absolute inset-0 w-full h-full" />
            </div>
          </UiCard>

          <UiCard title="Динамика пауз" subtitle="R (мин) по всем тренировкам">
            <div v-if="!activePlan" class="text-slate-600 text-sm">Сначала получите варианты тренировочного плана.</div>
            <div v-else class="relative h-64 max-h-64 w-full">
              <canvas ref="chartREl" class="absolute inset-0 w-full h-full" />
            </div>
          </UiCard>
        </div>

        <UiCard title="Пояснение выбранного плана" subtitle="Подробная математика + ссылки на постулаты">
          <div v-if="!activePlan" class="text-slate-600 text-sm">Сначала получите варианты тренировочного плана.</div>
          <div v-else class="prose max-w-none">
            <div class="font-medium text-slate-900">{{ activeVariant?.title }}</div>
            <div class="mt-2" v-html="activeVariant?.explanationHtml" />
          </div>
        </UiCard>

        <UiCard title="4 постулата управления нагрузкой" subtitle="Якоря для ссылок из пояснений">
          <div class="text-sm text-slate-700 space-y-3">
            <div :id="postulateIds.p1">
              <div class="font-medium text-slate-900">Постулат 1 — Индивидуальная чувствительность</div>
              <div class="text-slate-600">Абсолютная величина коэффициентов |b| показывает, какой параметр V/P/R сильнее влияет на маркер у конкретного спортсмена.</div>
            </div>
            <div :id="postulateIds.p2">
              <div class="font-medium text-slate-900">Постулат 2 — Скорость изменения маркеров</div>
              <div class="text-slate-600">Лог-модель позволяет интерпретировать b как относительные изменения; %ΔY ≈ (exp(b)−1)·100%.</div>
            </div>
            <div :id="postulateIds.p3">
              <div class="font-medium text-slate-900">Постулат 3 — Приоритет коррекции</div>
              <div class="text-slate-600">При выходе маркера из зоны корректируем параметр с наибольшим |b| и минимальной практической стоимостью (часто R).</div>
            </div>
            <div :id="postulateIds.p4">
              <div class="font-medium text-slate-900">Постулат 4 — Компенсация параметров</div>
              <div class="text-slate-600">Изменения V/P/R могут компенсировать друг друга: b1·ΔV + b2·ΔP + b3·ΔR ≈ 0.</div>
            </div>
          </div>
        </UiCard>

        <UiCard title="План" subtitle="Красивое отображение микроциклов">
          <div v-if="!activePlan" class="text-slate-600 text-sm">После получения вариантов здесь появится выбранный план микроциклов.</div>

          <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="(w, idx) in activePlan.weeks" :key="w.week" class="rounded-2xl border p-4">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div class="font-semibold">Неделя {{ w.week }}</div>
                  <div class="text-xs text-slate-600 mt-1">Модель: <b>{{ w.model }}</b></div>
                </div>
                <div class="text-xs text-slate-600">{{ weekDates(idx) }}</div>
              </div>

              <div class="mt-3 grid gap-3 lg:grid-cols-3">
                <div v-for="t in w.sessions" :key="t.id" class="rounded-2xl bg-slate-50 border p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <div class="font-medium">Тренировка {{ t.session }}</div>
                      <div class="text-xs text-slate-600 mt-1">V={{ t.V }} кг · P={{ t.P }} · R={{ t.R }} мин</div>
                    </div>
                    <span class="text-xs px-2 py-1 rounded-full" :class="statusChip(t)">
                      {{ t.flag }}
                    </span>
                  </div>

                  <div class="mt-3 text-sm text-slate-800 whitespace-pre-line">{{ t.workout }}</div>
                </div>
              </div>
            </div>
          </div>
        </UiCard>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import UiCard from '~/components/UiCard.vue'
import Field from '~/components/UiField.vue'
import Chart from 'chart.js/auto'
import { olsFit } from '~/utils/ols'

type Row = {
  V: number | null
  P: number | null
  R: number | null
  creatinine: number | null
  protein: number | null
  myoglobin: number | null
}

type RestBaseline = {
  creatinine: number | null
  protein: number | null
  myoglobin: number | null
}

type PlannedSession = {
  id: string
  week: number
  session: number
  focus: string
  model: string
  V: number
  P: number
  R: number
  workout: string
  flag: 'OK' | 'Внимание'
}

type PlannedWeek = {
  week: number
  model: string
  sessions: PlannedSession[]
}

type Plan = {
  createdAt: string
  competitionDate?: string
  weeks: PlannedWeek[]
}

type MarkerKey = 'creatinine' | 'protein' | 'myoglobin'
type Coeffs = { b0: number; b1: number; b2: number; b3: number }

type VariantSettings = {
  /** global scaling for V */
  V: number
  /** global scaling for P */
  P: number
  /** wave amplitude multiplier */
  wave: number
  /** which marker is used as control target when solving ΔR */
  control: MarkerKey
  /** shift of target in ln-space */
  targetShiftLn: number
  /** amplitude of target wave in ln-space */
  targetWaveLn: number
  /** clamp range for R (minutes) */
  rMin: number
  rMax: number
}

type PlanVariantId = 'balanced' | 'volume' | 'intensity' | 'recovery' | 'performance'
type PlanVariant = {
  id: PlanVariantId
  title: string
  subtitle: string
  explanationHtml: string
}

const postulateIds = {
  p1: 'postulate-1',
  p2: 'postulate-2',
  p3: 'postulate-3',
  p4: 'postulate-4',
} as const

const planVariants: PlanVariant[] = [
  {
    id: 'balanced',
    title: 'План A — Сбалансированный',
    subtitle: 'Умеренная вариативность V/P/R без перекосов',
    explanationHtml: `
<h3>1) Что мы считаем «моделью» плана</h3>
<p>
Вариант плана — это не просто таблица тренировок, а правило, как из базовой нагрузки (из периода наблюдения) получить последовательность
микроциклов до даты старта, сохраняя согласованность V/P/R через уравнение регрессии.
Смысл: <b>входы</b> (V, P, R) задают нагрузку, <b>выход</b> — прогнозируемый физиологический отклик (маркер Y).
</p>

<h3>2) Базовый уровень (точка отсчёта)</h3>
<p>
Из введённых недель наблюдения мы берём средние значения параметров нагрузки:
</p>
<div class="formula-block">
V<sub>0</sub>=mean(V),&nbsp; P<sub>0</sub>=mean(P),&nbsp; R<sub>0</sub>=mean(R)
</div>
<p>
И базовый уровень маркера (для выбранного контрольного маркера):
</p>
<div class="formula-block">
Y<sub>0</sub>=mean(Y),&nbsp; \u03BB<sub>0</sub>=ln(Y<sub>0</sub>)
</div>

<h3>3) Нормировка изменений (Δ)</h3>
<p>
Чтобы работать с относительными изменениями (и корректно читать %‑эффекты), используем относительные приращения:
</p>
<div class="formula-block">
\u0394V=(V-V<sub>0</sub>)/V<sub>0</sub>,&nbsp;
\u0394P=(P-P<sub>0</sub>)/P<sub>0</sub>,&nbsp;
\u0394R=(R-R<sub>0</sub>)/R<sub>0</sub>
</div>
<p>
Это напрямую связано с <a href="#${postulateIds.p2}">Постулатом 2</a> (скорость изменения маркеров в %).
</p>

<h3>4) Регрессионная связь «нагрузка \u2192 маркер»</h3>
<p>
Мы используем логарифмическую множественную регрессию:
</p>
<div class="formula-block">
ln(Y)=b<sub>0</sub>+b<sub>1</sub>\u0394V+b<sub>2</sub>\u0394P+b<sub>3</sub>\u0394R
</div>
<p>
Коэффициенты b отражают индивидуальную чувствительность спортсмена:
см. <a href="#${postulateIds.p1}">Постулат 1</a>.
</p>

<h3>5) Как из этого получается план (ключевой вывод)</h3>
<p>
План строится так: мы <b>задаём желаемые</b> \u0394V и \u0394P (по типу недели: объём/интенсивность/восстановление/пик),
а \u0394R вычисляем как компенсирующую поправку, чтобы удерживать контрольный маркер в запланированном коридоре.
Это прямое применение <a href="#${postulateIds.p4}">Постулата 4</a>.
</p>
<div class="formula-block">
\u0394R = ( ln(Y<sup>*</sup>) - b<sub>0</sub> - b<sub>1</sub>\u0394V - b<sub>2</sub>\u0394P ) / b<sub>3</sub>
</div>
<p>
Где Y<sup>*</sup> — целевое значение маркера на конкретную тренировку/неделю (в этом плане оно «мягко колеблется» вокруг Y<sub>0</sub>).
Далее восстанавливаем паузу:
</p>
<div class="formula-block">
R = R<sub>0</sub>\u22c5(1+\u0394R)
</div>
<p>
При выходе за допустимые пределы проще всего корректировать именно R (см. <a href="#${postulateIds.p3}">Постулат 3</a>).
</p>

<h3>6) Чем этот план отличается от других</h3>
<ul>
  <li><b>Сбалансированный</b>: умеренные изменения \u0394V и \u0394P, цель — ровная управляемая динамика без «перекосов».</li>
  <li>Вариативность присутствует, но приоритет — стабильность и предсказуемость.</li>
</ul>
`,
  },
  {
    id: 'volume',
    title: 'План B — Объёмный',
    subtitle: 'Акцент на V (тоннаж) при контролируемых паузах',
    explanationHtml: `
<h3>1) Идея плана</h3>
<p>
Цель — дать больший тренировочный стимул через рост объёма V (и умеренно через структуру P),
но не «вылететь» по биохимическому отклику. Управляем это через расчёт пауз R из уравнения.
</p>

<h3>2) Управляющие приоритеты</h3>
<ul>
  <li><b>Основной рычаг</b>: \u0394V выше, чем в других планах.</li>
  <li><b>Компенсация</b>: \u0394R подбирается так, чтобы контрольный маркер не уходил в опасную зону (<a href="#${postulateIds.p4}">Постулат 4</a>).</li>
  <li><b>Почему это работает</b>: если спортсмен чувствителен к V (|b<sub>1</sub>| велик), то небольшое изменение V даёт заметный эффект по Y (<a href="#${postulateIds.p1}">Постулат 1</a>).</li>
</ul>

<h3>3) Формулы (как именно считаем)</h3>
<p>
Мы задаём «более высокий» профиль \u0394V(t) по микроциклам. Например, для объёмной недели:
</p>
<div class="formula-block">
\u0394V(t) \u2191,&nbsp; \u0394P(t) \u2191 (умеренно),&nbsp; затем \u0394R(t) = ( ln(Y<sup>*</sup>) - b<sub>0</sub> - b<sub>1</sub>\u0394V - b<sub>2</sub>\u0394P ) / b<sub>3</sub>
</div>
<p>
Дальше восстанавливаем абсолютные значения:
</p>
<div class="formula-block">
V = V<sub>0</sub>\u22c5(1+\u0394V),&nbsp; P=P<sub>0</sub>\u22c5(1+\u0394P),&nbsp; R=R<sub>0</sub>\u22c5(1+\u0394R)
</div>

<h3>4) Что вы увидите на графиках</h3>
<ul>
  <li>V — выше и контрастнее.</li>
  <li>P — чуть выше в объёмных неделях (больше подъёмов при меньшем среднем весе).</li>
  <li>R — будет «подтягиваться» вверх именно там, где комбинация V/P по уравнению повышает прогноз Y.</li>
</ul>
`,
  },
  {
    id: 'intensity',
    title: 'План C — Интенсивностный',
    subtitle: 'Акцент на «тяжелее средний вес» через P↓ и R↑',
    explanationHtml: `
<h3>1) Идея плана</h3>
<p>
Интенсивность в вашей постановке управляется через P (число подъёмов, инверсия классической интенсивности):
P\u2193 \u2192 средний вес\u2191. Этот план делает P более контрастным, а паузы R подбирает из регрессии так,
чтобы физиологический отклик оставался управляемым.
</p>

<h3>2) Управляющие приоритеты</h3>
<ul>
  <li><b>Основной рычаг</b>: \u0394P ниже (P уменьшаем).</li>
  <li><b>Компенсация</b>: R увеличиваем настолько, насколько требуется уравнением (обычно \u0394R>0).</li>
  <li><b>Интерпретация эффекта</b>: так как модель логарифмическая, изменения читаются в % (<a href="#${postulateIds.p2}">Постулат 2</a>).</li>
</ul>

<h3>3) Вывод формулы коррекции R (пошагово)</h3>
<p>Берём базовый уровень (при \u0394V=\u0394P=\u0394R=0):</p>
<div class="formula-block">
ln(Y<sub>0</sub>) = b<sub>0</sub>
</div>
<p>Для конкретной тренировки задаём \u0394V и \u0394P, а целевой уровень ставим близко к Y<sub>0</sub> (или ниже, если нужно разгрузить):</p>
<div class="formula-block">
ln(Y<sup>*</sup>) = b<sub>0</sub> + \u03b5(t)
</div>
<p>Подставляем в регрессию и решаем относительно \u0394R:</p>
<div class="formula-block">
ln(Y<sup>*</sup>) = b<sub>0</sub> + b<sub>1</sub>\u0394V + b<sub>2</sub>\u0394P + b<sub>3</sub>\u0394R
\\
\u0394R = ( ln(Y<sup>*</sup>) - b<sub>0</sub> - b<sub>1</sub>\u0394V - b<sub>2</sub>\u0394P ) / b<sub>3</sub>
</div>
<p>
Это и есть формализованная коррекция по <a href="#${postulateIds.p4}">Постулату 4</a>, а выбор корректируемого параметра (обычно R) — по <a href="#${postulateIds.p3}">Постулату 3</a>.
</p>

<h3>4) Что вы увидите на графиках</h3>
<ul>
  <li>P — заметно ниже в интенсивных неделях.</li>
  <li>R — «взлетает» именно там, где комбинация (V,P) иначе дала бы рост Y.</li>
  <li>V — может быть ниже, но не обязательно: в интенсивных неделях часто V немного снижается.</li>
</ul>
`,
  },
  {
    id: 'recovery',
    title: 'План D — Восстановительный (бережный)',
    subtitle: 'Меньше V, мягче волны; удерживаем маркеры ниже базового',
    explanationHtml: `
<h3>1) Идея плана</h3>
<p>
Это вариант, когда приоритет — <b>восстановление и устойчивость</b>: объём V снижается, волны мягче,
а паузы R подбираются так, чтобы контрольный маркер держался <b>ниже базового уровня</b>.
</p>

<h3>2) Для кого подходит</h3>
<ul>
  <li>После тяжёлого блока / накопленной усталости</li>
  <li>При «пограничных» маркерах и необходимости разгрузиться без полного отдыха</li>
  <li>Когда важнее стабильность, чем прогресс любой ценой</li>
</ul>

<h3>3) Что меняется по сравнению с планом A</h3>
<ul>
  <li>V — ниже</li>
  <li>P — ближе к базовому или чуть выше (больше «лёгкой» работы)</li>
  <li>R — чаще растёт, потому что это самый “дешёвый” рычаг для снижения отклика (<a href="#${postulateIds.p3}">Постулат 3</a>)</li>
</ul>
`,
  },
  {
    id: 'performance',
    title: 'План E — Соревновательный (под результат)',
    subtitle: 'Меньше P (тяжелее), умеренный V, R под контролем по уравнению',
    explanationHtml: `
<h3>1) Идея плана</h3>
<p>
Этот вариант делает нагрузку «ближе к соревновательной»: <b>P ниже</b> (средний вес выше),
V умеренный, а R рассчитывается из регрессии так, чтобы держать физиологический отклик управляемым.
</p>

<h3>2) Чем отличается от плана C</h3>
<ul>
  <li>Волны более ровные (меньше «качелей» внутри недели)</li>
  <li>Целевой уровень маркера чуть ниже базового: меньше риска “перегреть” план</li>
  <li>Ориентация — на аккуратный перенос в пик без резких провалов/вылетов</li>
</ul>
`,
  },
]

const observationWeeks = ref<number>(4)
const sessionsPerWeek = ref<number>(3)
const competitionDate = ref<string>('')

// Дата начала плана (по умолчанию сегодня). От неё и до competitionDate строится план.
const startDate = ref<string>(new Date().toISOString().slice(0, 10))

const hasFilledData = computed(() => {
  return Object.values(rows.value).some(isFilled)
})

const canModel = computed(() => {
  return Boolean(competitionDate.value && startDate.value && hasFilledData.value)
})

const planWeeks = computed(() => {
  if (!competitionDate.value || !startDate.value) return 0
  const start = new Date(startDate.value)
  const end = new Date(competitionDate.value)
  const ms = end.getTime() - start.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)))
})

const rows = ref<Record<string, Row>>({})
const keyOf = (w: number, s: number) => `${w}-${s}`

const restBaseline = ref<RestBaseline>({
  creatinine: null,
  protein: null,
  myoglobin: null,
})

const ensureRows = () => {
  const next: Record<string, Row> = { ...rows.value }
  for (let w = 1; w <= observationWeeks.value; w++) {
    for (let s = 1; s <= sessionsPerWeek.value; s++) {
      const k = keyOf(w, s)
      if (!next[k]) {
        next[k] = { V: null, P: null, R: null, creatinine: null, protein: null, myoglobin: null }
      }
    }
  }
  // prune
  for (const k of Object.keys(next)) {
    const [w, s] = k.split('-').map(Number)
    if (w > observationWeeks.value || s > sessionsPerWeek.value) delete next[k]
  }
  rows.value = next
}

watch([observationWeeks, sessionsPerWeek], ensureRows, { immediate: true })

// ВАЖНО: "Недели наблюдения" — это период педагогического наблюдения/заборов.
// Тренировочный план, наоборот, строится от startDate до competitionDate (до даты старта).

// Persist UI state locally (чтобы дата и параметры не "слетали" при перерисовке)
const STORAGE_KEY = 'powerlift-planner:v1'
const saveState = () => {
  if (!process.client) return
  const payload = {
    observationWeeks: observationWeeks.value,
    sessionsPerWeek: sessionsPerWeek.value,
    startDate: startDate.value,
    competitionDate: competitionDate.value,
    restBaseline: restBaseline.value,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

watch([observationWeeks, sessionsPerWeek, startDate, competitionDate], saveState)
watch(restBaseline, saveState, { deep: true })

const getRow = (w: number, s: number) => rows.value[keyOf(w, s)]

const isFilled = (r: Row) => [r.V, r.P, r.R].every((x) => typeof x === 'number' && !Number.isNaN(x))
const chipText = (r: Row) => (isFilled(r) ? 'База' : '—')
const chipClass = (r: Row) => (isFilled(r) ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-slate-50 border border-slate-200 text-slate-600')

const summaryWeek = (w: number) => {
  const filled = Array.from({ length: sessionsPerWeek.value }, (_, i) => getRow(w, i + 1)).filter(isFilled).length
  return `Заполнено ${filled}/${sessionsPerWeek.value}`
}

const plans = ref<Partial<Record<PlanVariantId, Plan>>>({})
const activePlanId = ref<PlanVariantId>('balanced')
const activePlan = computed(() => plans.value[activePlanId.value] ?? null)
const activeVariant = computed(() => planVariants.find((v) => v.id === activePlanId.value) ?? null)

const selectPlan = async (id: PlanVariantId) => {
  activePlanId.value = id
  await nextTick()
  drawCharts()
}
const chartVEl = ref<HTMLCanvasElement | null>(null)
const chartPEl = ref<HTMLCanvasElement | null>(null)
const chartREl = ref<HTMLCanvasElement | null>(null)
let chartV: Chart | null = null
let chartP: Chart | null = null
let chartR: Chart | null = null

const expandedWeeks = ref<number[]>([1])

watch(observationWeeks, (n) => {
  // если пользователь увеличил число недель — автоматически раскрываем новые
  const set = new Set(expandedWeeks.value)
  for (let w = 1; w <= n; w++) set.add(w)
  expandedWeeks.value = Array.from(set).sort((a, b) => a - b)
})

const baseline = computed(() => {
  const all = Object.values(rows.value).filter(isFilled)
  const avg = (k: keyof Row) => {
    const vals = all.map((r) => r[k]).filter((v): v is number => typeof v === 'number')
    if (!vals.length) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }
  return {
    V: avg('V') ?? 8000,
    P: avg('P') ?? 60,
    R: avg('R') ?? 4.0,
    creatinine: avg('creatinine') ?? 5.0,
    protein: avg('protein') ?? 2.0,
    myoglobin: avg('myoglobin') ?? 20.0,
  }
})

const markerLabel = (m: MarkerKey) => (m === 'creatinine' ? 'Креатинин' : m === 'protein' ? 'Белок' : 'Миоглобин')

const mkDelta = (x: number, x0: number) => (x - x0) / Math.max(1e-9, x0)
const applyDelta = (x0: number, d: number) => x0 * (1 + d)

const getRestY0 = (m: MarkerKey): number => {
  const r = restBaseline.value[m]
  if (typeof r === 'number' && Number.isFinite(r) && r > 0) return r
  // fallback: если покой не введён, используем тренировочную "базу" (не идеально, но не ломает расчёт)
  const b = baseline.value[m]
  return typeof b === 'number' && Number.isFinite(b) && b > 0 ? b : 1
}

const defaultCoeffs = (m: MarkerKey): Coeffs => {
  const b = baseline.value
  const yTrain0 = b[m]
  const yRest0 = getRestY0(m)
  // Теперь зависимая переменная: Z = ln(Y / Y0)
  // Поэтому b0 ≈ ln(Y_train_base / Y_rest)
  const b0 = Math.log(Math.max(1e-9, yTrain0) / Math.max(1e-9, yRest0))
  // Фолбэк-коэффициенты: b1,b2>0, b3<0 (больше отдых -> меньше отклик)
  if (m === 'myoglobin') return { b0, b1: 0.85, b2: 0.25, b3: -0.55 }
  if (m === 'protein') return { b0, b1: 0.45, b2: 0.35, b3: -0.40 }
  return { b0, b1: 0.30, b2: 0.55, b3: -0.35 } // creatinine
}

const fitCoeffs = (m: MarkerKey): Coeffs => {
  const b = baseline.value
  const yRest0 = getRestY0(m)
  const samples = Object.values(rows.value).filter(
    (r) =>
      isFilled(r) &&
      typeof r[m] === 'number' &&
      Number.isFinite(r[m] as number) &&
      (r[m] as number) > 0
  )
  if (samples.length < 6) return defaultCoeffs(m)

  try {
    const X = samples.map((r) => {
      const dV = mkDelta(r.V as number, b.V)
      const dP = mkDelta(r.P as number, b.P)
      const dR = mkDelta(r.R as number, b.R)
      return [1, dV, dP, dR]
    })
    // зависимая переменная: Z_i = ln(Y_i / Y0)
    const y = samples.map((r) => Math.log((r[m] as number) / yRest0))
    const fit = olsFit(X, y)
    const beta = fit.beta as [number, number, number, number]
    const out: Coeffs = { b0: beta[0], b1: beta[1], b2: beta[2], b3: beta[3] }
    if (!Number.isFinite(out.b3) || Math.abs(out.b3) < 0.02) return defaultCoeffs(m)
    return out
  } catch {
    return defaultCoeffs(m)
  }
}

const VARIANT_DEFAULTS: Record<PlanVariantId, VariantSettings> = {
  balanced: { V: 1.0, P: 1.0, wave: 1.0, control: 'protein', targetShiftLn: 0.0, targetWaveLn: 0.02, rMin: 1, rMax: 12 },
  volume: { V: 1.08, P: 1.04, wave: 1.15, control: 'myoglobin', targetShiftLn: 0.0, targetWaveLn: 0.03, rMin: 1, rMax: 12 },
  intensity: { V: 0.96, P: 0.88, wave: 1.25, control: 'creatinine', targetShiftLn: -0.02, targetWaveLn: 0.03, rMin: 1, rMax: 12 },
  recovery: { V: 0.88, P: 1.06, wave: 0.85, control: 'protein', targetShiftLn: -0.03, targetWaveLn: 0.015, rMin: 1, rMax: 14 },
  performance: { V: 0.98, P: 0.84, wave: 1.05, control: 'myoglobin', targetShiftLn: -0.02, targetWaveLn: 0.02, rMin: 1, rMax: 14 },
}

const uid = () => {
  try {
    const c = globalThis.crypto as Crypto | undefined
    return c?.randomUUID ? c.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

const buildPlan = (variantId: PlanVariantId): Plan | null => {
  const base = baseline.value
  const total = planWeeks.value
  if (total <= 0) return null
  const settings = VARIANT_DEFAULTS[variantId]
  const coeffs = fitCoeffs(settings.control)

  const clampR = (x: number) => {
    const a = Math.min(settings.rMin, settings.rMax)
    const b = Math.max(settings.rMin, settings.rMax)
    return Math.min(b, Math.max(a, x))
  }

  const out: PlannedWeek[] = []
  for (let i = 0; i < total; i++) {
    const modelName = pickModel(i, total)

    // base scales by week type
    let Vmul = 1.0
    let Pmul = 1.0

    if (modelName.includes('Объём')) {
      Vmul = 1.12
      Pmul = 1.08
    } else if (modelName.includes('Интенсив')) {
      Vmul = 0.95
      Pmul = 0.85 // P↓ => тяжелее
    } else if (modelName.includes('Восстанов')) {
      Vmul = 0.75
      Pmul = 1.15
    } else if (modelName.includes('Пиков')) {
      Vmul = 0.65
      Pmul = 0.8
    }

    // tune per variant
    Vmul *= settings.V
    Pmul *= settings.P

    const sessions: PlannedSession[] = []
    for (let s = 1; s <= sessionsPerWeek.value; s++) {
      const focus = modelName.includes('Восстанов') ? 'Техника' : modelName.includes('Объём') ? 'Объём' : 'Сила'
      const withinWeekPhase = sessionsPerWeek.value > 1 ? (s - 1) / (sessionsPerWeek.value - 1) : 0
      const withinWeekWave = Math.sin(withinWeekPhase * Math.PI * 2) // -1..1
      const acrossWeeksWave = Math.sin((i + 1) * 0.9) // -1..1

      const V = Math.max(0, Math.round(base.V * Vmul * (1 + 0.06 * settings.wave * withinWeekWave + 0.03 * acrossWeeksWave)))
      const P = Math.max(10, Math.round(base.P * Pmul * (1 - 0.05 * settings.wave * withinWeekWave - 0.02 * acrossWeeksWave)))

      // 1) ΔV and ΔP
      const dV = mkDelta(V, base.V)
      const dP = mkDelta(P, base.P)

      // 2) target ln(Y*)
      const phase = (i + 1) * 0.7 + withinWeekPhase * 1.4
      const lnTarget = coeffs.b0 + settings.targetShiftLn + settings.targetWaveLn * Math.sin(phase)

      // 3) solve ΔR
      const dR = (lnTarget - coeffs.b0 - coeffs.b1 * dV - coeffs.b2 * dP) / coeffs.b3
      const Rraw = applyDelta(base.R, dR)
      const Rclamped = clampR(Rraw)
      const R = Math.round(Rclamped * 10) / 10

      const warn = !Number.isFinite(Rraw) || Rclamped !== Rraw

      sessions.push({
        id: uid(),
        week: i + 1,
        session: s,
        focus,
        model: modelName,
        V,
        P,
        R,
        workout: buildWorkout(focus, V, P),
        flag: warn ? 'Внимание' : 'OK',
      })
    }

    out.push({ week: i + 1, model: modelName, sessions })
  }

  return {
    createdAt: new Date().toISOString(),
    competitionDate: competitionDate.value || undefined,
    weeks: out,
  }
}

const pickModel = (weekIndexZero: number, totalWeeks: number) => {
  const w = weekIndexZero + 1
  const last = totalWeeks
  if (w >= last - 1) return 'Пиковый (taper)'
  if (w % 4 === 0) return 'Восстановительный'
  if (w % 2 === 0) return 'Интенсивностный'
  return 'Объёмный'
}

const buildWorkout = (focus: string, V: number, P: number) => {
  // Очень простые шаблоны: задают структуру и объём. Вы сможете заменить их на свои.
  const round5 = (x: number) => Math.round(x / 5) * 5
  const mainPct = focus === 'Сила' ? 0.82 : focus === 'Объём' ? 0.70 : 0.60
  const mainReps = focus === 'Сила' ? '5×3' : focus === 'Объём' ? '5×6' : '3×5'
  const benchReps = focus === 'Сила' ? '5×3' : focus === 'Объём' ? '4×8' : '3×6'
  const deadReps = focus === 'Сила' ? '4×2' : focus === 'Объём' ? '4×5' : '2×3'
  // "условный" рабочий вес из V и P: средний вес ~ V / P
  const avgW = V / Math.max(1, P)
  const squatW = round5(avgW / mainPct)
  const benchW = round5((avgW * 0.65) / mainPct)
  const deadW = round5((avgW * 0.9) / mainPct)

  return [
    `Присед: ${mainReps} @ ~${squatW} кг`,
    `Жим: ${benchReps} @ ~${benchW} кг`,
    `Тяга: ${deadReps} @ ~${deadW} кг`,
    `Аксессуары: 2–3 упражнения по 3–4 подхода (спина/трицепс/задняя цепь)`,
  ].join('\n')
}

const model = async () => {
  plans.value = {
    balanced: buildPlan('balanced') || undefined,
    volume: buildPlan('volume') || undefined,
    intensity: buildPlan('intensity') || undefined,
    recovery: buildPlan('recovery') || undefined,
    performance: buildPlan('performance') || undefined,
  }
  activePlanId.value = activePlanId.value || 'balanced'

  await nextTick()
  drawCharts()
}

const flatPlan = computed(() => (activePlan.value ? activePlan.value.weeks.flatMap((w) => w.sessions) : []))

const drawCharts = () => {
  if (!activePlan.value) return
  const data = flatPlan.value
  const labels = data.map((d) => `Н${d.week}·Т${d.session}`)

  const mk = (el: HTMLCanvasElement | null, prev: Chart | null, label: string, values: number[]) => {
    if (!el) return prev
    if (prev) prev.destroy()
    return new Chart(el.getContext('2d')!, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label, data: values }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: { y: { beginAtZero: false } },
        plugins: { legend: { position: 'bottom' } },
      },
    })
  }

  chartV = mk(chartVEl.value, chartV, 'V (кг)', data.map((d) => d.V))
  chartP = mk(chartPEl.value, chartP, 'P (раз)', data.map((d) => d.P))
  chartR = mk(chartREl.value, chartR, 'R (мин)', data.map((d) => d.R))
}

const statusChip = (t: PlannedSession) =>
  t.flag === 'OK'
    ? 'bg-emerald-50 border border-emerald-100 text-emerald-800'
    : 'bg-amber-50 border border-amber-100 text-amber-800'

const weekDates = (weekIndexZero: number) => {
  if (!startDate.value) return ''
  const start = new Date(startDate.value)
  const a = new Date(start)
  a.setDate(a.getDate() + weekIndexZero * 7)
  const b = new Date(a)
  b.setDate(b.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  return `${fmt(a)}–${fmt(b)}`
}

const resetAll = () => {
  rows.value = {}
  ensureRows()
  plans.value = {}
  restBaseline.value = { creatinine: null, protein: null, myoglobin: null }
  if (chartV) chartV.destroy()
  if (chartP) chartP.destroy()
  if (chartR) chartR.destroy()
  chartV = chartP = chartR = null
}

const fillDemo = () => {
  // Демо не меняет введённые weeks/sessionsPerWeek/дату — только заполняет таблицу.
  // Если дата старта не задана — ставим через 8 недель от старта по умолчанию.
  if (!startDate.value) startDate.value = new Date().toISOString().slice(0, 10)
  if (!competitionDate.value) {
    const target = new Date(startDate.value)
    target.setDate(target.getDate() + 8 * 7)
    competitionDate.value = target.toISOString().slice(0, 10)
  }
  ensureRows()
  // Демо для пробы в покое (Y0): просто положительные значения, чтобы работал ln(Y/Y0)
  restBaseline.value = { creatinine: 3.5, protein: 1.0, myoglobin: 10.0 }
  const patterns = [
    // Паузы (R) специально в диапазоне 1–3 минут (по просьбе).
    { V: 9500, P: 72, R: 1.2, creatinine: 5.5, protein: 2.4, myoglobin: 25.0 },
    { V: 8800, P: 64, R: 1.8, creatinine: 6.2, protein: 3.2, myoglobin: 38.0 },
    { V: 7600, P: 56, R: 2.4, creatinine: 4.8, protein: 2.0, myoglobin: 18.0 },
    { V: 6800, P: 60, R: 2.9, creatinine: 4.2, protein: 1.6, myoglobin: 12.0 },
  ]

  for (let w = 1; w <= observationWeeks.value; w++) {
    for (let s = 1; s <= sessionsPerWeek.value; s++) {
      const idx = (w + s) % patterns.length
      rows.value[keyOf(w, s)] = { ...rows.value[keyOf(w, s)], ...patterns[idx] }
    }
  }
  // раскрыть все недели наблюдения
  expandedWeeks.value = Array.from({ length: observationWeeks.value }, (_, i) => i + 1)
  plans.value = {}
  if (chartV) chartV.destroy()
  if (chartP) chartP.destroy()
  if (chartR) chartR.destroy()
  chartV = chartP = chartR = null
}

const exportPdf = async () => {
  if (!activePlan.value) return
  const chartPngDataUrls = {
    V: chartVEl.value ? chartVEl.value.toDataURL('image/png', 1.0) : '',
    P: chartPEl.value ? chartPEl.value.toDataURL('image/png', 1.0) : '',
    R: chartREl.value ? chartREl.value.toDataURL('image/png', 1.0) : '',
  }

  const planText = activePlan.value.weeks
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

  const subtitle = competitionDate.value
    ? `Дата соревнований: ${competitionDate.value} · ${activeVariant.value?.title ?? ''}`.trim()
    : `Сформировано: ${new Date(activePlan.value.createdAt).toLocaleString('ru-RU')} · ${activeVariant.value?.title ?? ''}`.trim()

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

onMounted(() => {
  if (!process.client) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (typeof parsed?.observationWeeks === 'number') observationWeeks.value = parsed.observationWeeks
    if (typeof parsed?.sessionsPerWeek === 'number') sessionsPerWeek.value = parsed.sessionsPerWeek
    if (typeof parsed?.startDate === 'string') startDate.value = parsed.startDate
    if (typeof parsed?.competitionDate === 'string') competitionDate.value = parsed.competitionDate
    if (parsed?.restBaseline && typeof parsed.restBaseline === 'object') {
      const rb = parsed.restBaseline
      restBaseline.value = {
        creatinine: typeof rb.creatinine === 'number' ? rb.creatinine : null,
        protein: typeof rb.protein === 'number' ? rb.protein : null,
        myoglobin: typeof rb.myoglobin === 'number' ? rb.myoglobin : null,
      }
    }
  } catch {
    // ignore
  }

  // пересоздать сетку после восстановления состояния
  ensureRows()
  expandedWeeks.value = Array.from({ length: observationWeeks.value }, (_, i) => i + 1)
})
</script>

<style scoped>
@media (max-width: 767px) {
  .mobile-cards-vertical {
    display: flex !important;
    flex-direction: column !important;
    gap: 1.25rem !important;
  }
}
.input {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 12px;
  background: #ffffff;
  outline: none;
}
.input:focus {
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.45);
  border-color: #cbd5e1;
}
</style>
