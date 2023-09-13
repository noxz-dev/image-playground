import { AnnotationViewer } from "~/core/viewer";
import { IPoint } from "~/core/viewer";

export async function applyPointsToImage(points: IPoint[], viewer: Ref<AnnotationViewer | undefined>) {

  if(!viewer.value) return

  // send a network request here to your api with the points and the image. Use for example a mulitpart form

  const resp: Response = await $fetch('https://picsum.photos/200/300')

  // transform array buffer to file and create a blob url
  const blob = new Blob([new Uint8Array(await resp.arrayBuffer())])

  // create a blob url from the returned blob
  const url = URL.createObjectURL(blob)

  // cleanup the old image
  viewer.value.cleanup()

  // set the the new image as the source
  viewer.value.imageSource = url
}
