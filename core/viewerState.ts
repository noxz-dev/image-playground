import { User } from 'model/user';
import { reactive, ref } from 'vue';

export const polygonChanged = reactive<{
  changed: boolean;
  loading: boolean;
}>({
  changed: false,
  loading: false
});

export const viewerLoadingState = reactive<{
  dataLoaded: boolean;
  tilesLoaded: boolean;
  annotationsLoaded: boolean;
  solveResultLoading: boolean;
  solutionLoading: boolean;
}>({
  dataLoaded: false,
  tilesLoaded: false,
  annotationsLoaded: false,
  solveResultLoading: false,
  solutionLoading: false
});

export const isTaskSaving = ref<boolean>(false);

export const userSolutionLocked = ref<boolean>(false);
export const showSolution = ref<boolean>(false);

export const viewerZoom = ref<number>();
export const viewerScale = ref<number>();

export const selectedUser = ref<User | undefined>();


export const annotationsToUser = new Map<string, User>();
export const updateUserSolutions = ref<boolean>(false);
export const userSolutionAnnotationsLoading = ref<boolean>(false);

