<template>
  <div>
    <div id="viewerImage" ref="viewerRef" class="h-screen bg-gray-900 overflow-hidden"></div>
  </div>
</template>

<script lang="ts" setup>
import { generateViewerOptions } from "~/core/generateViewerOptions";
import {AnnotationViewer} from "~/core/viewer"
import { viewerLoadingState } from "~/core/viewerState";

const drawingViewer = ref<AnnotationViewer>();

onMounted(() => {
  viewerLoadingState.annotationsLoaded = false;

  const viewerOptions = generateViewerOptions('viewerImage', 'https://images.unsplash.com/photo-1692467482423-e7c47521a4e4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2670&q=80');

  drawingViewer.value = new AnnotationViewer(viewerOptions);

  // new OpenSeadragon.MouseTracker({
  //   element: drawingViewer.value!.viewer.canvas,
  //   clickHandler: clickHandler,
  //   moveHandler: moveHandler
  // });
});
</script>
