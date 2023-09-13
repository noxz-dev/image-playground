<template>
  <div class="relative">
    <div id="viewerImage" ref="viewerRef" class="h-screen bg-[#161618] overflow-hidden"></div>
    <div class="absolute bottom-5 left-1/2">
      <Menubar />
    </div>
    <div class="absolute bottom-5 right-5">
      <Button :variant="'secondary'" @click="handleButton"> Apply Image Points </Button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { generateViewerOptions } from "~/core/generateViewerOptions";
import { AnnotationViewer } from "~/core/viewer";
import { viewerLoadingState } from "~/core/viewerState";
import {Button} from '~/components/ui/button'
import { applyPointsToImage} from "~/core/lib"

const drawingViewer = ref<AnnotationViewer>();

onMounted(() => {
  viewerLoadingState.annotationsLoaded = false;

  const viewerOptions = generateViewerOptions(
    "viewerImage",
    "https://images.unsplash.com/photo-1682686581264-c47e25e61d95?ixlib=rb-4.0.3&ixid=M3wxMjA3fDF8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2574&q=80",
  );

  drawingViewer.value = new AnnotationViewer(viewerOptions);
});

function handleButton() {
  const points = drawingViewer.value?.circles
  if(!points) return

  applyPointsToImage(points, drawingViewer);
}
</script>
