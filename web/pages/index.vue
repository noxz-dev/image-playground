<template>
  <div class="relative">
    <div id="viewerImage" ref="viewerRef" class="h-screen bg-[#161618] overflow-hidden"></div>
    <div class="absolute bottom-5 left-1/2">
      <Menubar />
    </div>
    <div class="absolute bottom-5 right-5" v-if="active == 'TRANSLATE'">
      <Button :variant="'secondary'" @click="open = true"> Apply Image Points </Button>
    </div>
    <div class="absolute bottom-5 right-5" v-if="active == 'SAM'">
      <Button :variant="'secondary'" @click="applySam" :disabled="loading"> 
        <span v-if="!loading">Apply SAM</span>
        <span v-else><Icon name="eos-icons:loading"/></span>
      </Button>
    </div>
    <div class="absolute top-5 left-5">
      <div class="mt-4 flex items-center gap-4">
        <label for="file-input" class="sr-only">Import CSV file</label>
        <input
          @change="(e: Event) => handleFile(e)"
          type="file"
          name="file-input"
          id="file-input"
          class="block w-full rounded-md border border-gray-200 bg-white pr-4 text-sm shadow-sm file:mr-4 file:border-0 file:bg-gray-200 file:bg-transparent file:px-4 file:py-3 focus:z-10 focus:border-blue-500 focus:ring-blue-500"
        />
      </div>
    </div>
  </div>
  <DimensionInput :open="open" @close="open = false" @apply="handleButton" :loading="loading"/>

</template>

<script lang="ts" setup>
import { generateViewerOptions } from "~/core/generateViewerOptions";
import { AnnotationViewer } from "~/core/viewer";
import { viewerLoadingState } from "~/core/viewerState";
import { Button } from "~/components/ui/button";
import { CustomAnnotationViewer, applyPointsToImage, applySamToImage } from "~/core/lib";
import { activeMode } from "~/core/store";

const active = computed(() => activeMode.value);
const open = ref(false);
const loading = ref(false);

const drawingViewer = ref<AnnotationViewer>();

onMounted(() => {
  viewerLoadingState.annotationsLoaded = false;

  const viewerOptions = generateViewerOptions(
    "viewerImage",
    "https://fastly.picsum.photos/id/13/2500/1667.jpg?hmac=SoX9UoHhN8HyklRA4A3vcCWJMVtiBXUg0W4ljWTor7s",
  );

  drawingViewer.value = new AnnotationViewer(viewerOptions);
});

async function handleButton(payload: { x: number; y: number }) {
  const points = drawingViewer.value?.circles;
  if (!points) return;
  loading.value = true;

  await applyPointsToImage(points, drawingViewer as Ref<CustomAnnotationViewer>, payload);

  open.value = false;
  loading.value = false;

}

watch(activeMode, () => {
  if (active.value == "TRANSLATE") {
    drawingViewer.value?.togglePolygons(true);
  } else {
    drawingViewer.value?.togglePolygons(false);
  }
});

async function handleFile(e: Event) {
  if (e.target == null) return;

  const target = e.target as HTMLInputElement;

  if (!target.files) return;

  
  const file = target.files[0];

  if (!file) return;

  const url = URL.createObjectURL(file);

  drawingViewer.value!.imageSource = url;

  activeMode.value = 'TRANSLATE'
}

async function applySam() {
  loading.value = true;
  await applySamToImage(drawingViewer as Ref<CustomAnnotationViewer>)
  loading.value = false;
}
</script>
