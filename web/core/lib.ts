import { AnnotationViewer } from "~/core/viewer";
import { IPoint } from "~/core/viewer";

export interface CustomAnnotationViewer extends AnnotationViewer {
  viewer: {
    tileSources: { url: string };
  } & OpenSeadragon.Viewer;
}

export async function applyPointsToImage(points: IPoint[], viewer: Ref<CustomAnnotationViewer | undefined>, dimensions: {x: number, y: number}) {


  const absoluteCorners = points.map(point => {
    return {
      x: point.x * dimensions.x,
      y: (1 - point.y) * dimensions.y  // (1 - y) to make the starting point at the left bottom
    };
  });

  if(!viewer.value) return

  const file = await urlToFile(viewer.value.viewer.tileSources.url, 'image.jpg', 'image/jpeg')

  // send a network request here to your api with the points and the image. Use for example a mulitpart form

  const formData = new FormData();

  formData.append('points', JSON.stringify(absoluteCorners));

  formData.append('file', file);

  formData.append('dimensions', JSON.stringify(dimensions))

  const resp: Response = await $fetch('http://localhost:8000/process_image', {
    method: 'POST',
    body: formData,
  })

  // transform array buffer to file and create a blob url
  const blob = new Blob([new Uint8Array(await resp.arrayBuffer())])

  // create a blob url from the returned blob
  const url = URL.createObjectURL(blob)

  // cleanup the old image
  viewer.value.cleanup()

  // set the the new image as the source
  viewer.value.imageSource = url
}

export async function applySamToImage(viewer: Ref<CustomAnnotationViewer | undefined>) {

  if(!viewer.value) return 

  const file = await urlToFile(viewer.value.viewer.tileSources.url, 'image.jpg', 'image/jpeg')

  const formData = new FormData();

  formData.append('file', file);

  const resp: Response = await $fetch('http://localhost:8000/sam', {
    method: 'POST',
    body: formData,
  })

  // transform array buffer to file and create a blob url
  const blob = new Blob([new Uint8Array(await resp.arrayBuffer())])

  // create a blob url from the returned blob
  const url = URL.createObjectURL(blob)

  // cleanup the old image
  viewer.value.cleanup()

  // set the the new image as the source
  viewer.value.imageSource = url
}


async function urlToFile(url:string, filename: string, mimeType: string) {
  // Fetch the image as blob
  const response = await fetch(url);
  const blob = await response.blob();

  // Convert the blob to file
  return new File([blob], filename, { type: mimeType });
}
