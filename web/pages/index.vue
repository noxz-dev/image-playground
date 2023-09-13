<template>
  <div class="relative">
    <div id="viewerImage" ref="viewerRef" class="h-screen bg-[#161618] overflow-hidden"></div>
    <div class="absolute bottom-5 left-1/2">
      <Menubar />
    </div>
    <div class="absolute bottom-5 right-5" v-if="active == 'TRANSLATE'">
      <Button :variant="'secondary'" @click="handleButton"> Apply Image Points </Button>
    </div>
    <div class="absolute top-5 left-5">
      <div class="mt-4 flex items-center gap-4">
									<label for="file-input" class="sr-only"
										>Import CSV file</label
									>
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
</template>

<script lang="ts" setup>
import { generateViewerOptions } from "~/core/generateViewerOptions";
import { AnnotationViewer } from "~/core/viewer";
import { viewerLoadingState } from "~/core/viewerState";
import {Button} from '~/components/ui/button'
import { applyPointsToImage} from "~/core/lib"
import {activeMode} from '~/core/store'

const active = computed(() => activeMode.value)

const drawingViewer = ref<AnnotationViewer>();

onMounted(() => {
  viewerLoadingState.annotationsLoaded = false;

  const viewerOptions = generateViewerOptions(
    "viewerImage",
    "https://fastly.picsum.photos/id/13/2500/1667.jpg?hmac=SoX9UoHhN8HyklRA4A3vcCWJMVtiBXUg0W4ljWTor7s",
  );

  drawingViewer.value = new AnnotationViewer(viewerOptions);
});

function handleButton() {
  const points = drawingViewer.value?.circles
  if(!points) return

  applyPointsToImage(points, drawingViewer);
}

watch(activeMode, () => {
  if(active.value == 'PLACEHOLDER') {
    drawingViewer.value?.toggleCircles()
  } else {
    drawingViewer.value?.toggleCircles()
  }})

async function handleFile(e: Event) {

  if (e.target == null) return;
  const target = e.target as HTMLInputElement;

  if (!target.files) return;

  const file = target.files[0];

  if (!file) return;

  const url = URL.createObjectURL(file);

  drawingViewer.value.imageSource = url

}

</script>
