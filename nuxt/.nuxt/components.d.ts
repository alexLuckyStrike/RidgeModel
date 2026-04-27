
import type { DefineComponent, SlotsType } from 'vue'
type IslandComponent<T extends DefineComponent> = T & DefineComponent<{}, {refresh: () => Promise<void>}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, SlotsType<{ fallback: { error: unknown } }>>
type HydrationStrategies = {
  hydrateOnVisible?: IntersectionObserverInit | true
  hydrateOnIdle?: number | true
  hydrateOnInteraction?: keyof HTMLElementEventMap | Array<keyof HTMLElementEventMap> | true
  hydrateOnMediaQuery?: string
  hydrateAfter?: number
  hydrateWhen?: boolean
  hydrateNever?: true
}
type LazyComponent<T> = (T & DefineComponent<HydrationStrategies, {}, {}, {}, {}, {}, {}, { hydrated: () => void }>)
interface _GlobalComponents {
      'AppHeader': typeof import("../components/AppHeader.vue")['default']
    'ContentPage': typeof import("../components/ContentPage.vue")['default']
    'MarkdownRender': typeof import("../components/MarkdownRender.vue")['default']
    'PasswordModal': typeof import("../components/PasswordModal.vue")['default']
    'UiCard': typeof import("../components/UiCard.vue")['default']
    'UiField': typeof import("../components/UiField.vue")['default']
    'UiForm': typeof import("../components/UiForm.vue")['default']
    'PlannerObservationWeek': typeof import("../components/planner/ObservationWeek.vue")['default']
    'PlannerPlanWeekCard': typeof import("../components/planner/PlanWeekCard.vue")['default']
    'PlannerCharts': typeof import("../components/planner/PlannerCharts.vue")['default']
    'PlannerSessionCardMobile': typeof import("../components/planner/SessionCardMobile.vue")['default']
    'PlannerSessionRowDesktop': typeof import("../components/planner/SessionRowDesktop.vue")['default']
    'PlannerSessionTableHeader': typeof import("../components/planner/SessionTableHeader.vue")['default']
    'PlannerCardsPlannerBaselineCard': typeof import("../components/planner/cards/PlannerBaselineCard.vue")['default']
    'PlannerCardsPlannerDataCardHelpers': typeof import("../components/planner/cards/PlannerDataCard/PlannerDataCard.helpers")['default']
    'PlannerCardsPlannerDataCard': typeof import("../components/planner/cards/PlannerDataCard/PlannerDataCard.vue")['default']
    'PlannerCardsPlannerModelingCard': typeof import("../components/planner/cards/PlannerModelingCard/PlannerModelingCard.vue")['default']
    'PlannerCardsPlannerModelingCardRunModel': typeof import("../components/planner/cards/PlannerModelingCard/runModel")['default']
    'PlannerCardsPlannerPeriodCard': typeof import("../components/planner/cards/PlannerPeriodCard.vue")['default']
    'PlannerMvpAfterLoadCard': typeof import("../components/planner/mvp/PlannerMvpAfterLoadCard.vue")['default']
    'PlannerMvpLoadCard': typeof import("../components/planner/mvp/PlannerMvpLoadCard.vue")['default']
    'PlannerMvpRestCard': typeof import("../components/planner/mvp/PlannerMvpRestCard.vue")['default']
    'PlannerMvpScalesCard': typeof import("../components/planner/mvp/PlannerMvpScalesCard.vue")['default']
    'NuxtWelcome': typeof import("../node_modules/nuxt/dist/app/components/welcome.vue")['default']
    'NuxtLayout': typeof import("../node_modules/nuxt/dist/app/components/nuxt-layout")['default']
    'NuxtErrorBoundary': typeof import("../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
    'ClientOnly': typeof import("../node_modules/nuxt/dist/app/components/client-only")['default']
    'DevOnly': typeof import("../node_modules/nuxt/dist/app/components/dev-only")['default']
    'ServerPlaceholder': typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']
    'NuxtLink': typeof import("../node_modules/nuxt/dist/app/components/nuxt-link")['default']
    'NuxtLoadingIndicator': typeof import("../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
    'NuxtTime': typeof import("../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
    'NuxtRouteAnnouncer': typeof import("../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
    'NuxtImg': typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
    'NuxtPicture': typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
    'NuxtPage': typeof import("../node_modules/nuxt/dist/pages/runtime/page")['default']
    'NoScript': typeof import("../node_modules/nuxt/dist/head/runtime/components")['NoScript']
    'Link': typeof import("../node_modules/nuxt/dist/head/runtime/components")['Link']
    'Base': typeof import("../node_modules/nuxt/dist/head/runtime/components")['Base']
    'Title': typeof import("../node_modules/nuxt/dist/head/runtime/components")['Title']
    'Meta': typeof import("../node_modules/nuxt/dist/head/runtime/components")['Meta']
    'Style': typeof import("../node_modules/nuxt/dist/head/runtime/components")['Style']
    'Head': typeof import("../node_modules/nuxt/dist/head/runtime/components")['Head']
    'Html': typeof import("../node_modules/nuxt/dist/head/runtime/components")['Html']
    'Body': typeof import("../node_modules/nuxt/dist/head/runtime/components")['Body']
    'NuxtIsland': typeof import("../node_modules/nuxt/dist/app/components/nuxt-island")['default']
    'NuxtRouteAnnouncer': IslandComponent<typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']>
      'LazyAppHeader': LazyComponent<typeof import("../components/AppHeader.vue")['default']>
    'LazyContentPage': LazyComponent<typeof import("../components/ContentPage.vue")['default']>
    'LazyMarkdownRender': LazyComponent<typeof import("../components/MarkdownRender.vue")['default']>
    'LazyPasswordModal': LazyComponent<typeof import("../components/PasswordModal.vue")['default']>
    'LazyUiCard': LazyComponent<typeof import("../components/UiCard.vue")['default']>
    'LazyUiField': LazyComponent<typeof import("../components/UiField.vue")['default']>
    'LazyUiForm': LazyComponent<typeof import("../components/UiForm.vue")['default']>
    'LazyPlannerObservationWeek': LazyComponent<typeof import("../components/planner/ObservationWeek.vue")['default']>
    'LazyPlannerPlanWeekCard': LazyComponent<typeof import("../components/planner/PlanWeekCard.vue")['default']>
    'LazyPlannerCharts': LazyComponent<typeof import("../components/planner/PlannerCharts.vue")['default']>
    'LazyPlannerSessionCardMobile': LazyComponent<typeof import("../components/planner/SessionCardMobile.vue")['default']>
    'LazyPlannerSessionRowDesktop': LazyComponent<typeof import("../components/planner/SessionRowDesktop.vue")['default']>
    'LazyPlannerSessionTableHeader': LazyComponent<typeof import("../components/planner/SessionTableHeader.vue")['default']>
    'LazyPlannerCardsPlannerBaselineCard': LazyComponent<typeof import("../components/planner/cards/PlannerBaselineCard.vue")['default']>
    'LazyPlannerCardsPlannerDataCardHelpers': LazyComponent<typeof import("../components/planner/cards/PlannerDataCard/PlannerDataCard.helpers")['default']>
    'LazyPlannerCardsPlannerDataCard': LazyComponent<typeof import("../components/planner/cards/PlannerDataCard/PlannerDataCard.vue")['default']>
    'LazyPlannerCardsPlannerModelingCard': LazyComponent<typeof import("../components/planner/cards/PlannerModelingCard/PlannerModelingCard.vue")['default']>
    'LazyPlannerCardsPlannerModelingCardRunModel': LazyComponent<typeof import("../components/planner/cards/PlannerModelingCard/runModel")['default']>
    'LazyPlannerCardsPlannerPeriodCard': LazyComponent<typeof import("../components/planner/cards/PlannerPeriodCard.vue")['default']>
    'LazyPlannerMvpAfterLoadCard': LazyComponent<typeof import("../components/planner/mvp/PlannerMvpAfterLoadCard.vue")['default']>
    'LazyPlannerMvpLoadCard': LazyComponent<typeof import("../components/planner/mvp/PlannerMvpLoadCard.vue")['default']>
    'LazyPlannerMvpRestCard': LazyComponent<typeof import("../components/planner/mvp/PlannerMvpRestCard.vue")['default']>
    'LazyPlannerMvpScalesCard': LazyComponent<typeof import("../components/planner/mvp/PlannerMvpScalesCard.vue")['default']>
    'LazyNuxtWelcome': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/welcome.vue")['default']>
    'LazyNuxtLayout': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
    'LazyNuxtErrorBoundary': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
    'LazyClientOnly': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/client-only")['default']>
    'LazyDevOnly': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/dev-only")['default']>
    'LazyServerPlaceholder': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']>
    'LazyNuxtLink': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-link")['default']>
    'LazyNuxtLoadingIndicator': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
    'LazyNuxtTime': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
    'LazyNuxtRouteAnnouncer': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
    'LazyNuxtImg': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
    'LazyNuxtPicture': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
    'LazyNuxtPage': LazyComponent<typeof import("../node_modules/nuxt/dist/pages/runtime/page")['default']>
    'LazyNoScript': LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['NoScript']>
    'LazyLink': LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Link']>
    'LazyBase': LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Base']>
    'LazyTitle': LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Title']>
    'LazyMeta': LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Meta']>
    'LazyStyle': LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Style']>
    'LazyHead': LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Head']>
    'LazyHtml': LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Html']>
    'LazyBody': LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Body']>
    'LazyNuxtIsland': LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-island")['default']>
    'LazyNuxtRouteAnnouncer': LazyComponent<IslandComponent<typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']>>
}

declare module 'vue' {
  export interface GlobalComponents extends _GlobalComponents { }
}

export const AppHeader: typeof import("../components/AppHeader.vue")['default']
export const ContentPage: typeof import("../components/ContentPage.vue")['default']
export const MarkdownRender: typeof import("../components/MarkdownRender.vue")['default']
export const PasswordModal: typeof import("../components/PasswordModal.vue")['default']
export const UiCard: typeof import("../components/UiCard.vue")['default']
export const UiField: typeof import("../components/UiField.vue")['default']
export const UiForm: typeof import("../components/UiForm.vue")['default']
export const PlannerObservationWeek: typeof import("../components/planner/ObservationWeek.vue")['default']
export const PlannerPlanWeekCard: typeof import("../components/planner/PlanWeekCard.vue")['default']
export const PlannerCharts: typeof import("../components/planner/PlannerCharts.vue")['default']
export const PlannerSessionCardMobile: typeof import("../components/planner/SessionCardMobile.vue")['default']
export const PlannerSessionRowDesktop: typeof import("../components/planner/SessionRowDesktop.vue")['default']
export const PlannerSessionTableHeader: typeof import("../components/planner/SessionTableHeader.vue")['default']
export const PlannerCardsPlannerBaselineCard: typeof import("../components/planner/cards/PlannerBaselineCard.vue")['default']
export const PlannerCardsPlannerDataCardHelpers: typeof import("../components/planner/cards/PlannerDataCard/PlannerDataCard.helpers")['default']
export const PlannerCardsPlannerDataCard: typeof import("../components/planner/cards/PlannerDataCard/PlannerDataCard.vue")['default']
export const PlannerCardsPlannerModelingCard: typeof import("../components/planner/cards/PlannerModelingCard/PlannerModelingCard.vue")['default']
export const PlannerCardsPlannerModelingCardRunModel: typeof import("../components/planner/cards/PlannerModelingCard/runModel")['default']
export const PlannerCardsPlannerPeriodCard: typeof import("../components/planner/cards/PlannerPeriodCard.vue")['default']
export const PlannerMvpAfterLoadCard: typeof import("../components/planner/mvp/PlannerMvpAfterLoadCard.vue")['default']
export const PlannerMvpLoadCard: typeof import("../components/planner/mvp/PlannerMvpLoadCard.vue")['default']
export const PlannerMvpRestCard: typeof import("../components/planner/mvp/PlannerMvpRestCard.vue")['default']
export const PlannerMvpScalesCard: typeof import("../components/planner/mvp/PlannerMvpScalesCard.vue")['default']
export const NuxtWelcome: typeof import("../node_modules/nuxt/dist/app/components/welcome.vue")['default']
export const NuxtLayout: typeof import("../node_modules/nuxt/dist/app/components/nuxt-layout")['default']
export const NuxtErrorBoundary: typeof import("../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']
export const ClientOnly: typeof import("../node_modules/nuxt/dist/app/components/client-only")['default']
export const DevOnly: typeof import("../node_modules/nuxt/dist/app/components/dev-only")['default']
export const ServerPlaceholder: typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']
export const NuxtLink: typeof import("../node_modules/nuxt/dist/app/components/nuxt-link")['default']
export const NuxtLoadingIndicator: typeof import("../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']
export const NuxtTime: typeof import("../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']
export const NuxtRouteAnnouncer: typeof import("../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']
export const NuxtImg: typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']
export const NuxtPicture: typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']
export const NuxtPage: typeof import("../node_modules/nuxt/dist/pages/runtime/page")['default']
export const NoScript: typeof import("../node_modules/nuxt/dist/head/runtime/components")['NoScript']
export const Link: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Link']
export const Base: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Base']
export const Title: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Title']
export const Meta: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Meta']
export const Style: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Style']
export const Head: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Head']
export const Html: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Html']
export const Body: typeof import("../node_modules/nuxt/dist/head/runtime/components")['Body']
export const NuxtIsland: typeof import("../node_modules/nuxt/dist/app/components/nuxt-island")['default']
export const NuxtRouteAnnouncer: IslandComponent<typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyAppHeader: LazyComponent<typeof import("../components/AppHeader.vue")['default']>
export const LazyContentPage: LazyComponent<typeof import("../components/ContentPage.vue")['default']>
export const LazyMarkdownRender: LazyComponent<typeof import("../components/MarkdownRender.vue")['default']>
export const LazyPasswordModal: LazyComponent<typeof import("../components/PasswordModal.vue")['default']>
export const LazyUiCard: LazyComponent<typeof import("../components/UiCard.vue")['default']>
export const LazyUiField: LazyComponent<typeof import("../components/UiField.vue")['default']>
export const LazyUiForm: LazyComponent<typeof import("../components/UiForm.vue")['default']>
export const LazyPlannerObservationWeek: LazyComponent<typeof import("../components/planner/ObservationWeek.vue")['default']>
export const LazyPlannerPlanWeekCard: LazyComponent<typeof import("../components/planner/PlanWeekCard.vue")['default']>
export const LazyPlannerCharts: LazyComponent<typeof import("../components/planner/PlannerCharts.vue")['default']>
export const LazyPlannerSessionCardMobile: LazyComponent<typeof import("../components/planner/SessionCardMobile.vue")['default']>
export const LazyPlannerSessionRowDesktop: LazyComponent<typeof import("../components/planner/SessionRowDesktop.vue")['default']>
export const LazyPlannerSessionTableHeader: LazyComponent<typeof import("../components/planner/SessionTableHeader.vue")['default']>
export const LazyPlannerCardsPlannerBaselineCard: LazyComponent<typeof import("../components/planner/cards/PlannerBaselineCard.vue")['default']>
export const LazyPlannerCardsPlannerDataCardHelpers: LazyComponent<typeof import("../components/planner/cards/PlannerDataCard/PlannerDataCard.helpers")['default']>
export const LazyPlannerCardsPlannerDataCard: LazyComponent<typeof import("../components/planner/cards/PlannerDataCard/PlannerDataCard.vue")['default']>
export const LazyPlannerCardsPlannerModelingCard: LazyComponent<typeof import("../components/planner/cards/PlannerModelingCard/PlannerModelingCard.vue")['default']>
export const LazyPlannerCardsPlannerModelingCardRunModel: LazyComponent<typeof import("../components/planner/cards/PlannerModelingCard/runModel")['default']>
export const LazyPlannerCardsPlannerPeriodCard: LazyComponent<typeof import("../components/planner/cards/PlannerPeriodCard.vue")['default']>
export const LazyPlannerMvpAfterLoadCard: LazyComponent<typeof import("../components/planner/mvp/PlannerMvpAfterLoadCard.vue")['default']>
export const LazyPlannerMvpLoadCard: LazyComponent<typeof import("../components/planner/mvp/PlannerMvpLoadCard.vue")['default']>
export const LazyPlannerMvpRestCard: LazyComponent<typeof import("../components/planner/mvp/PlannerMvpRestCard.vue")['default']>
export const LazyPlannerMvpScalesCard: LazyComponent<typeof import("../components/planner/mvp/PlannerMvpScalesCard.vue")['default']>
export const LazyNuxtWelcome: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/welcome.vue")['default']>
export const LazyNuxtLayout: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-layout")['default']>
export const LazyNuxtErrorBoundary: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-error-boundary.vue")['default']>
export const LazyClientOnly: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/client-only")['default']>
export const LazyDevOnly: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/dev-only")['default']>
export const LazyServerPlaceholder: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']>
export const LazyNuxtLink: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-link")['default']>
export const LazyNuxtLoadingIndicator: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-loading-indicator")['default']>
export const LazyNuxtTime: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-time.vue")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-route-announcer")['default']>
export const LazyNuxtImg: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtImg']>
export const LazyNuxtPicture: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-stubs")['NuxtPicture']>
export const LazyNuxtPage: LazyComponent<typeof import("../node_modules/nuxt/dist/pages/runtime/page")['default']>
export const LazyNoScript: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['NoScript']>
export const LazyLink: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Link']>
export const LazyBase: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Base']>
export const LazyTitle: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Title']>
export const LazyMeta: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Meta']>
export const LazyStyle: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Style']>
export const LazyHead: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Head']>
export const LazyHtml: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Html']>
export const LazyBody: LazyComponent<typeof import("../node_modules/nuxt/dist/head/runtime/components")['Body']>
export const LazyNuxtIsland: LazyComponent<typeof import("../node_modules/nuxt/dist/app/components/nuxt-island")['default']>
export const LazyNuxtRouteAnnouncer: LazyComponent<IslandComponent<typeof import("../node_modules/nuxt/dist/app/components/server-placeholder")['default']>>

export const componentNames: string[]
