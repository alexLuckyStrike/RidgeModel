<template>
  <div class="space-y-6">
    <section class="grid lg:grid-cols-12 gap-6 items-start">
      <div class="lg:col-span-7 space-y-6">
        <div class="space-y-4">
          <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight">
            Диссертация: моделирование тренировочного процесса в пауэрлифтинге
          </h1>
          <p class="text-slate-700 leading-relaxed">
            Идея: управлять параметрами нагрузки (<b>V</b> — объём в кг, <b>P</b> — количество подъёмов, <b>R</b> — отдых между подходами)
            через прогноз концентраций биомаркеров мочи, измеренных через 2 часа после тренировки
            (<b>креатинин</b>, <b>белок</b>, <b>миоглобин/гемоглобин</b>).
          </p>

          <div class="flex flex-col sm:flex-row gap-3">
            <NuxtLink
              to="/planner"
              class="inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-medium"
              :class="cta === 'planner' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'"
              @click="cta='planner'"
            >
              Открыть планировщик
            </NuxtLink>

            <button
              type="button"
              class="inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-medium"
              :class="cta === 'model' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'"
              @click="scrollToModel"
            >
              Посмотреть объяснение
            </button>
          </div>
        </div>

        <div id="model" class="space-y-6">
        <UiCard title="Логарифмическая регрессия (ваш случай)">
          <div class="space-y-3 text-slate-700 leading-relaxed">
            <p>
              Для каждого маркера (креатинин, белок, миоглобин) мы получаем набор коэффициентов <b>b0, b1, b2, b3</b>.
              Их можно понимать как «веса», которые показывают, <b>какой параметр нагрузки сильнее всего двигает маркер</b>.
            </p>

            <div class="space-y-2">
              <div><b>b0</b> — базовый уровень маркера для спортсмена в его обычном режиме (точка отсчёта).</div>
              <div><b>b1 (V)</b> — насколько маркер чувствителен к изменению <b>объёма</b> (тоннажа): больше/меньше работы в кг.</div>
              <div><b>b2 (P)</b> — насколько маркер чувствителен к изменению <b>количества подъёмов</b>: это про структуру нагрузки и «плотность» работы (при том же V больше подъёмов обычно означает легче средний вес).</div>
              <div><b>b3 (R)</b> — насколько маркер чувствителен к изменению <b>отдыха</b> между подходами: это рычаг восстановления и “снятия” остроты нагрузки.</div>
            </div>

            <div class="space-y-2">
              <div><b>Знак коэффициента</b> говорит направление: если коэффициент положительный — рост параметра обычно повышает маркер; если отрицательный — снижает.</div>
              <div><b>Модуль коэффициента</b> говорит силу: чем больше |коэффициент|, тем сильнее и быстрее этот параметр влияет на маркер.</div>
            </div>

            <div class="space-y-2">
              <div class="font-medium">Уравнения для каждого маркера</div>
              <div class="text-sm text-slate-600">
                Важно: коэффициенты у каждого маркера свои, поэтому ниже они записаны с индексами.
              </div>
              <div class="space-y-2">
                <div class="font-mono bg-slate-100 px-2 py-1 rounded-lg">ln(Креатинин) = b0_cr + bV_cr·V + bP_cr·P + bR_cr·R</div>
                <div class="font-mono bg-slate-100 px-2 py-1 rounded-lg">ln(Белок) = b0_pr + bV_pr·V + bP_pr·P + bR_pr·R</div>
                <div class="font-mono bg-slate-100 px-2 py-1 rounded-lg">ln(Миоглобин) = b0_my + bV_my·V + bP_my·P + bR_my·R</div>
              </div>
            </div>
          </div>
        </UiCard>

        <UiCard title="Как управляем нагрузкой (коротко)">
          <div class="space-y-3 text-slate-700 leading-relaxed">
            <p><b>Прогноз:</b> подставляем V, P, R → получаем прогноз маркеров → сравниваем с целевой зоной.</p>
            <p>
              <b>Коррекция:</b> если маркер вышел из зоны, считаем
              <span class="font-mono bg-slate-100 px-2 py-1 rounded-lg">Δln(Y)</span>
              и меняем параметр с максимальным |коэф.| (обычно это R), затем проверяем моделью.
            </p>
            <p><b>Компенсации:</b> рост V можно компенсировать ростом R или изменением P (4-й постулат).</p>
          </div>
        </UiCard>
        </div>
      </div>

      <div class="lg:col-span-5 space-y-6">
        <UiCard title="4 постулата (что даёт модель)">
          <ol class="list-decimal pl-5 space-y-2 text-slate-700">
            <li><b>Индивидуальная чувствительность:</b> сравнение |коэф.| показывает, к чему спортсмен наиболее восприимчив (V, P или R).</li>
            <li><b>Скорость изменения:</b> коэффициент задаёт процентное изменение маркера при изменении параметра на 1 единицу.</li>
            <li><b>Приоритет коррекции:</b> самый большой |коэф.| — лучший «рычаг» для быстрых правок без разрушения плана.</li>
            <li><b>Взаимодействие параметров:</b> рост одного параметра можно компенсировать другими, удерживая маркер в целевой зоне.</li>
          </ol>
        </UiCard>

        <UiCard title="Референсные зоны (как в работе)">
          <div class="space-y-4 text-sm text-slate-700">
            <div>
              <div class="font-semibold">Креатинин (мг/кг)</div>
              <div class="mt-1 grid grid-cols-3 gap-2">
                <div class="rounded-xl bg-emerald-50 border border-emerald-100 p-3"><div class="font-medium">Норма</div><div>0.9–3.9</div></div>
                <div class="rounded-xl bg-amber-50 border border-amber-100 p-3"><div class="font-medium">Средне</div><div>4–8</div></div>
                <div class="rounded-xl bg-rose-50 border border-rose-100 p-3"><div class="font-medium">Много</div><div>17.7–26.5</div></div>
              </div>
            </div>
            <div>
              <div class="font-semibold">Белок (мг/л)</div>
              <div class="mt-1 grid grid-cols-3 gap-2">
                <div class="rounded-xl bg-emerald-50 border border-emerald-100 p-3"><div class="font-medium">Норма</div><div>0.1–1</div></div>
                <div class="rounded-xl bg-amber-50 border border-amber-100 p-3"><div class="font-medium">Средне</div><div>1.1–2.9</div></div>
                <div class="rounded-xl bg-rose-50 border border-rose-100 p-3"><div class="font-medium">Много</div><div>3.5–20</div></div>
              </div>
            </div>
            <div>
              <div class="font-semibold">Миоглобин/«гемоглобин» (мкг/л)</div>
              <div class="mt-1 grid grid-cols-3 gap-2">
                <div class="rounded-xl bg-emerald-50 border border-emerald-100 p-3"><div class="font-medium">Норма</div><div>0.1–0.9</div></div>
                <div class="rounded-xl bg-amber-50 border border-amber-100 p-3"><div class="font-medium">Средне</div><div>1–50</div></div>
                <div class="rounded-xl bg-rose-50 border border-rose-100 p-3"><div class="font-medium">Много</div><div>50.1–250</div></div>
              </div>
            </div>
          </div>
        </UiCard>

        <UiCard title="Дальше">
          <div class="space-y-2 text-sm text-slate-700">
            <div>Следующий шаг: добавить расчёт регрессии и генерацию планов прямо в приложении.</div>
            <NuxtLink to="/planner" class="mt-2 block w-full text-center px-4 py-2.5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800">
              Перейти к вводу данных
            </NuxtLink>
          </div>
        </UiCard>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UiCard from '~/components/UiCard.vue'

const cta = ref<'planner' | 'model'>('planner')

const scrollToModel = () => {
  cta.value = 'model'
  const el = document.getElementById('model')
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>