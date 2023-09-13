import OpenSeadragon, { Point, Viewer } from "openseadragon";

import { SvgOverlay } from "./svg-overlay";
import { viewerLoadingState, viewerScale, viewerZoom } from "./viewerState";

export interface IPoint {
  x: number;
  y: number;
}

export class AnnotationViewer {
  private _overlay: SvgOverlay;

  constructor(viewerOptions: OpenSeadragon.Options) {
    this._viewer = OpenSeadragon(viewerOptions);

    // @ts-ignore
    this._viewer.innerTracker.keyHandler = null;

    new OpenSeadragon.TileCache({
      maxImageCacheCount: 500,
    });

    // Needs to be there, so opensedragon knows that the svg overlay exists
    new SvgOverlay(this._viewer);

    this._overlay = this._viewer.svgOverlay();

    const self = this;

    this._viewer.addHandler("open", () => {
      viewerZoom.value = this.zoom;
      viewerScale.value = this.scale;

      viewerLoadingState.tilesLoaded = true;

      this._viewer.viewport.zoomBy(1);

      var svgNS = "http://www.w3.org/2000/svg";
      var polygon = document.createElementNS(svgNS, "polygon");
      polygon.setAttribute("fill", "none");
      polygon.setAttribute("stroke", "white");
      polygon.setAttribute("stroke-width", "0.002");
      var points: Element[] = [];

      const { height, width } = self.viewer.world.getItemAt(0).getBounds();

      var corners: IPoint[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 * height },
        { x: 0, y: 1 * height },
      ];

      // Add polygon to SVG overlay
      self._overlay.node().appendChild(polygon);

      corners.forEach(function (corner) {
        var circle = document.createElementNS(svgNS, "circle");
        circle.id = crypto.randomUUID();
        circle.setAttribute("cx", corner.x.toString());
        circle.setAttribute("cy", corner.y.toString());
        circle.setAttribute("r", (0.009).toString());
        circle.setAttribute("fill", "#1DB954");
        circle.setAttribute("class", "draggable");

        self._overlay.node().appendChild(circle);
        points.push(circle);

        // Add dragging functionality
        const dragHandler = (event: any) => {
          const viewportDelta = self._viewer.viewport.deltaPointsFromPixels(event.delta);

          let newCx = Number(circle.getAttribute("cx")) + Number(viewportDelta.x);
          let newCy = Number(circle.getAttribute("cy")) + Number(viewportDelta.y);

          newCx = Math.max(0, Math.min(newCx, width));
          newCy = Math.max(0, Math.min(newCy, height));

          circle.setAttribute("cx", newCx.toString());
          circle.setAttribute("cy", newCy.toString());

          updatePolygon();
        };

        new OpenSeadragon.MouseTracker({
          element: circle,
          dragHandler: dragHandler,
        }).setTracking(true);
      });

      const updatePolygon = () => {
        const pointsAttr = points
          .map((point) => {
            return point.getAttribute("cx") + "," + point.getAttribute("cy");
          })
          .join(" ");

        polygon.setAttribute("points", pointsAttr);
      };

      updatePolygon();
    });
  }

  public cleanup() {
    // clean up cricles
    this._overlay
      .node()
      .querySelectorAll("circle")
      .forEach((circle) => {
        circle.remove();
      });
    //clean up polygon
    this._overlay
      .node()
      .querySelectorAll("polygon")
      .forEach((polygon) => {
        polygon.remove();
      }
    );
  }

  private _viewer: OpenSeadragon.Viewer;

  get viewer(): Viewer {
    return this._viewer;
  }

  private _stopDraggingIndicator: boolean = false;

  set stopDraggingIndicator(value: boolean) {
    this._stopDraggingIndicator = value;
  }

  get scale(): number {
    // @ts-ignore
    return this._viewer.viewport._containerInnerSize.x * this._viewer.viewport.getZoom(true);
  }

  get zoom(): number {
    return this._viewer.viewport.getZoom();
  }

  get maxZoom() {
    return this._viewer.viewport.getMaxZoom();
  }

  // return the coordinates of the circles in the viewer
  get circles(): IPoint[] {
    const circles: IPoint[] = [];

    this._overlay
      .node()
      .querySelectorAll("circle")
      .forEach((circle) => {
        circles.push({
          x: Number(circle.getAttribute("cx")),
          y: Number(circle.getAttribute("cy")),
        });
      });

    return circles;
  }

  set imageSource(value: string) {
    this._viewer.open({
      type: "image",
      url: value,
    });
  }
}

const webToViewport = (x: number, y: number, viewer: Viewer): Point => {
  const point = new Point(x, y);
  return viewer.viewport.pointFromPixel(point);
};
