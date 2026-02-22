import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import {
  useMvpStore,
  type MvpAnalysisResult,
  type MvpPreview,
} from "~/stores/mvp";

type MvpSingleKey = "scale2" | "scale5";
type MvpMultiKey = "rest2";
export type MvpKey = MvpSingleKey | MvpMultiKey;

type Load5SetField = "first" | "second" | "workoutPhoto" | "workoutText";

type DemoFileItem = {
  name: string;
  path: string;
};

type MvpDemoPayload = {
  status?: string;
  notes?: string[];
  scales?: DemoFileItem[];
  rest?: DemoFileItem[];
  load?: DemoFileItem[];
  workout?: DemoFileItem[];
};

const imageExtRegex = /\.(jpg|jpeg|png|heic|webp)$/i;

const MVP_COLLAPSE_KEY = "planner:mvp-collapsed";
const WEEKS_INPUT_COLLAPSE_KEY = "planner:weeks-input-collapsed";

const MVP_MAX_FILE_SIZE = 10 * 1024 * 1024;
const MVP_MAX_FILE_SIZE_MB = 10;
const MVP_MULTI_LIMIT = 2;
export const MVP_LOAD5_MAX_SETS = 20;

export function usePlannerMvp(uid: () => string) {
  const mvpCollapsed = ref(true);
  const mvpLoading = ref(false);
  const mvpDemoLoading = ref(false);
  const mvpError = ref<string | null>(null);
  const weeksInputCollapsed = ref(false);

  const mvpStore = useMvpStore();
  const { load5Sets, analysisResult } = storeToRefs(mvpStore);
  const {
    addLoad5Set: addLoad5SetRaw,
    removeLoad5Set: removeLoad5SetRaw,
    resetLoad5Sets,
    setAnalysisResult,
    clearAnalysisResult,
  } = mvpStore;
  const mvpResult = analysisResult;

  const mvpFiles = reactive<{
    scale2: MvpPreview | null;
    scale5: MvpPreview | null;
    rest2: MvpPreview[];
  }>({
    scale2: null,
    scale5: null,
    rest2: [],
  });

  const hasMvpFiles = computed(() => {
    return Boolean(
      mvpFiles.scale2 ||
        mvpFiles.scale5 ||
        mvpFiles.rest2.length ||
        load5Sets.value.some(
          (set) =>
            set.first || set.second || set.workoutPhoto || set.workoutText
        )
    );
  });

  const toggleMvp = () => {
    mvpCollapsed.value = !mvpCollapsed.value;
  };

  const toggleWeeksInput = () => {
    weeksInputCollapsed.value = !weeksInputCollapsed.value;
  };

  const createMvpPreview = (file: File): MvpPreview => ({
    id: uid(),
    file,
    url: process.client ? URL.createObjectURL(file) : "",
    name: file.name,
    size: file.size,
  });

  const revokeMvpPreview = (preview: MvpPreview | null) => {
    if (!process.client || !preview?.url) return;
    URL.revokeObjectURL(preview.url);
  };

  const handleMvpFileChange = (event: Event, key: MvpKey) => {
    if (!process.client) return;
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) return;

    if (!mvpLoading.value) {
      mvpError.value = null;
    }

    const selectedFiles = Array.from(input.files);
    const oversize = selectedFiles.filter((file) => file.size > MVP_MAX_FILE_SIZE);
    const validFiles = selectedFiles.filter((file) => file.size <= MVP_MAX_FILE_SIZE);

    if (oversize.length) {
      const names = oversize.map((file) => `«${file.name}»`).join(", ");
      mvpError.value = `Файлы ${names} превышают ${MVP_MAX_FILE_SIZE_MB} МБ и не были добавлены.`;
    }

    if (!validFiles.length) {
      input.value = "";
      return;
    }

    if (key === "rest2") {
      const list = mvpFiles[key];
      const remaining = MVP_MULTI_LIMIT - list.length;
      if (remaining <= 0) {
        mvpError.value = `Можно загрузить не более ${MVP_MULTI_LIMIT} изображений в этот раздел.`;
        input.value = "";
        return;
      }
      const limitedFiles = validFiles.slice(0, remaining);
      if (validFiles.length > remaining) {
        mvpError.value = `Можно загрузить не более ${MVP_MULTI_LIMIT} изображений. Лишние файлы не добавлены.`;
      }
      limitedFiles.forEach((file) => {
        list.push(createMvpPreview(file));
      });
    } else {
      const singleKey = key as MvpSingleKey;
      const current = mvpFiles[singleKey];
      if (current) revokeMvpPreview(current);
      const [file] = validFiles;
      mvpFiles[singleKey] = file ? createMvpPreview(file) : null;
    }

    input.value = "";
  };

  const addLoad5Set = () => {
    if (load5Sets.value.length >= MVP_LOAD5_MAX_SETS) {
      mvpError.value = `Можно добавить не более ${MVP_LOAD5_MAX_SETS} измерений.`;
      return;
    }
    addLoad5SetRaw();
  };

  const handleLoad5SetFileChange = (
    event: Event,
    setId: string,
    field: Load5SetField
  ) => {
    if (!process.client) return;
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) return;

    if (!mvpLoading.value) {
      mvpError.value = null;
    }

    const [file] = Array.from(input.files);
    if (!file) return;
    if (file.size > MVP_MAX_FILE_SIZE) {
      mvpError.value = `Файл «${file.name}» превышает ${MVP_MAX_FILE_SIZE_MB} МБ и не был добавлен.`;
      input.value = "";
      return;
    }

    const set = load5Sets.value.find((item) => item.id === setId);
    if (!set) {
      input.value = "";
      return;
    }

    const current = set[field];
    if (current) revokeMvpPreview(current);
    set[field] = createMvpPreview(file);
    input.value = "";
  };

  const removeLoad5SetFile = (setId: string, field: Load5SetField) => {
    const set = load5Sets.value.find((item) => item.id === setId);
    if (!set) return;
    const current = set[field];
    if (current) revokeMvpPreview(current);
    set[field] = null;
  };

  const removeLoad5Set = (setId: string) => {
    const set = load5Sets.value.find((item) => item.id === setId);
    if (!set) return;
    if (set.first) revokeMvpPreview(set.first);
    if (set.second) revokeMvpPreview(set.second);
    if (set.workoutPhoto) revokeMvpPreview(set.workoutPhoto);
    if (set.workoutText) revokeMvpPreview(set.workoutText);
    removeLoad5SetRaw(setId);
    if (!load5Sets.value.length) resetLoad5Sets();
  };

  const removeMvpFile = (key: MvpKey, id?: string) => {
    if (key === "rest2") {
      const list = mvpFiles[key];
      const index = list.findIndex((item) => item.id === id);
      if (index !== -1) {
        const [removed] = list.splice(index, 1);
        revokeMvpPreview(removed);
      }
      return;
    }

    const singleKey = key as MvpSingleKey;
    const current = mvpFiles[singleKey];
    if (current) {
      revokeMvpPreview(current);
      mvpFiles[singleKey] = null;
    }
  };

  const clearAllMvpPreviews = () => {
    if (!process.client) return;
    (["scale2", "scale5"] as MvpSingleKey[]).forEach((singleKey) => {
      const preview = mvpFiles[singleKey];
      if (preview) revokeMvpPreview(preview);
      mvpFiles[singleKey] = null;
    });
    (["rest2"] as MvpMultiKey[]).forEach((multiKey) => {
      const list = mvpFiles[multiKey];
      list.forEach((item) => revokeMvpPreview(item));
      list.splice(0, list.length);
    });

    load5Sets.value.forEach((set) => {
      if (set.first) revokeMvpPreview(set.first);
      if (set.second) revokeMvpPreview(set.second);
      if (set.workoutPhoto) revokeMvpPreview(set.workoutPhoto);
      if (set.workoutText) revokeMvpPreview(set.workoutText);
    });
    resetLoad5Sets();
  };

  const analyzeMvp = async () => {
    if (!hasMvpFiles.value || mvpLoading.value) return;

    const formData = new FormData();

    if (mvpFiles.scale2) formData.append("scale2", mvpFiles.scale2.file);
    if (mvpFiles.scale5) formData.append("scale5", mvpFiles.scale5.file);

    mvpFiles.rest2.forEach((item, index) => {
      formData.append(`rest2_${index}`, item.file);
    });

    load5Sets.value.forEach((set, index) => {
      if (set.first) formData.append(`load5_${index}_a`, set.first.file);
      if (set.second) formData.append(`load5_${index}_b`, set.second.file);
      if (set.workoutPhoto)
        formData.append(`workout_photo_${index}`, set.workoutPhoto.file);
      if (set.workoutText)
        formData.append(`workout_text_${index}`, set.workoutText.file);
    });

    mvpLoading.value = true;
    mvpError.value = null;
    clearAnalysisResult();

    try {
      const response = await fetch("/api/cv-analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Не удалось выполнить анализ. Попробуйте ещё раз.";
        try {
          const errorPayload = await response.json();
          message = errorPayload?.message || errorPayload?.error || message;
        } catch {
          const text = await response.text();
          if (text) message = text;
        }
        throw new Error(message);
      }

      const payload = await response.json();

      if (payload?.status === "error" || payload?.error) {
        mvpError.value =
          payload.message || payload.error || "Сервис вернул ошибку анализа.";
        clearAnalysisResult();
        return;
      }

      if (payload && typeof payload === "object") {
        setAnalysisResult(payload as MvpAnalysisResult);
        console.log("[MVP] analysis result saved to store", payload);
      } else {
        mvpError.value = "Сервис вернул пустой ответ.";
        clearAnalysisResult();
      }
    } catch (error) {
      mvpError.value =
        error instanceof Error
          ? error.message
          : "Произошла неизвестная ошибка анализа.";
      clearAnalysisResult();
    } finally {
      mvpLoading.value = false;
    }
  };

  const fetchDemoFile = async (item: DemoFileItem): Promise<File> => {
    const url = `/api/mvp-demo-file?path=${encodeURIComponent(item.path)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Не удалось загрузить файл: ${item.name}`);
    }
    const blob = await response.blob();
    return new File([blob], item.name, {
      type: blob.type || "application/octet-stream",
    });
  };

  const loadMvpDemoData = async () => {
    if (mvpLoading.value || mvpDemoLoading.value) return;

    mvpDemoLoading.value = true;
    mvpError.value = null;
    clearAnalysisResult();

    try {
      const dataset = await $fetch<MvpDemoPayload>("/api/mvp-demo-data");
      if (!dataset || dataset.status === "error") {
        throw new Error("Сервер не вернул демоданные для MVP.");
      }

      clearAllMvpPreviews();

      const [scale2Item, scale5Item] = (dataset.scales || []).slice(0, 2);
      if (scale2Item) {
        mvpFiles.scale2 = createMvpPreview(await fetchDemoFile(scale2Item));
      }
      if (scale5Item) {
        mvpFiles.scale5 = createMvpPreview(await fetchDemoFile(scale5Item));
      }

      const restItems = (dataset.rest || []).slice(0, MVP_MULTI_LIMIT);
      for (const restItem of restItems) {
        mvpFiles.rest2.push(createMvpPreview(await fetchDemoFile(restItem)));
      }

      const loadItems = (dataset.load || []).slice(0, MVP_LOAD5_MAX_SETS);
      const workoutItems = dataset.workout || [];

      const setCount = Math.max(
        1,
        loadItems.length,
        workoutItems.length
      );

      for (let i = 0; i < setCount; i += 1) {
        if (i > 0) addLoad5SetRaw();
        const set = load5Sets.value[i];
        if (!set) continue;

        const afterLoad = loadItems[i];
        if (afterLoad) {
          set.second = createMvpPreview(await fetchDemoFile(afterLoad));
        }

        const workoutItem = workoutItems[i];
        if (workoutItem) {
          const workoutFile = await fetchDemoFile(workoutItem);
          set.workoutText = createMvpPreview(workoutFile);
          if (imageExtRegex.test(workoutItem.name)) {
            set.workoutPhoto = createMvpPreview(workoutFile);
          }
        }
      }

      if (!hasMvpFiles.value) {
        mvpError.value = "Не удалось найти подходящие файлы демоданных MVP.";
      }

      if (dataset.notes?.length) {
        console.log("[MVP] demo data notes", dataset.notes);
      }
      console.log("[MVP] demo data loaded", {
        scales: Number(Boolean(mvpFiles.scale2)) + Number(Boolean(mvpFiles.scale5)),
        rest: mvpFiles.rest2.length,
        loadSets: load5Sets.value.filter((set) => Boolean(set.first || set.second)).length,
      });
    } catch (error) {
      mvpError.value =
        error instanceof Error
          ? error.message
          : "Не удалось загрузить MVP демоданные.";
    } finally {
      mvpDemoLoading.value = false;
    }
  };

  watch(mvpCollapsed, (value) => {
    if (!process.client) return;
    localStorage.setItem(MVP_COLLAPSE_KEY, value ? "true" : "false");
  });

  watch(weeksInputCollapsed, (value) => {
    if (!process.client) return;
    localStorage.setItem(WEEKS_INPUT_COLLAPSE_KEY, value ? "true" : "false");
  });

  onMounted(() => {
    if (!process.client) return;

    const storedCollapse = localStorage.getItem(MVP_COLLAPSE_KEY);
    if (storedCollapse === null) {
      mvpCollapsed.value = true;
      localStorage.setItem(MVP_COLLAPSE_KEY, "true");
    } else {
      mvpCollapsed.value = storedCollapse === "true";
    }

    const storedWeeksCollapse = localStorage.getItem(WEEKS_INPUT_COLLAPSE_KEY);
    if (storedWeeksCollapse === null) {
      weeksInputCollapsed.value = false;
      localStorage.setItem(WEEKS_INPUT_COLLAPSE_KEY, "false");
    } else {
      weeksInputCollapsed.value = storedWeeksCollapse === "true";
    }
  });

  onBeforeUnmount(() => {
    clearAllMvpPreviews();
  });

  return {
    // state
    mvpCollapsed,
    mvpLoading,
    mvpDemoLoading,
    mvpError,
    mvpResult,
    weeksInputCollapsed,
    mvpFiles,
    load5Sets,
    hasMvpFiles,
    // actions
    toggleMvp,
    toggleWeeksInput,
    handleMvpFileChange,
    removeMvpFile,
    analyzeMvp,
    loadMvpDemoData,
    // load5
    addLoad5Set,
    removeLoad5Set,
    handleLoad5SetFileChange,
    removeLoad5SetFile,
    // utils
    clearAllMvpPreviews,
    revokeMvpPreview,
    // constants for template
    MVP_LOAD5_MAX_SETS,
  };
}
