import OpenSeadragon, { Point, Viewer } from 'openseadragon';

import { SvgOverlay } from './svg-overlay';
import { viewerLoadingState, viewerScale, viewerZoom } from './viewerState';

interface IPoint {
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
      maxImageCacheCount: 500
    });

    // Needs to be there, so opensedragon knows that the svg overlay exists
    new SvgOverlay(this._viewer);
   
    this._overlay = this._viewer.svgOverlay();

    const self = this

    this._viewer.addHandler('open', () => {
      const opacity = this.zoom < 0.5 ? 0 : 1;

      viewerZoom.value = this.zoom;
      viewerScale.value = this.scale;

      viewerLoadingState.tilesLoaded = true;

      this._viewer.viewport.zoomBy(1);

      var svgNS = "http://www.w3.org/2000/svg";
      var polygon = document.createElementNS(svgNS, 'polygon');
      polygon.setAttribute('fill', 'none');
      polygon.setAttribute('stroke', 'white');
      polygon.setAttribute('stroke-width', '0.002');
      var points: Element[] = [];
  
      var corners: IPoint[] = [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
      ];
  
      corners.forEach(function(corner) {
          var circle = document.createElementNS(svgNS, 'circle');
          circle.id = crypto.randomUUID()
          circle.setAttribute('cx', corner.x.toString());
          circle.setAttribute('cy', corner.y.toString());
          circle.setAttribute('r', 0.009.toString());
          circle.setAttribute('fill', 'red');
          circle.setAttribute('class', 'draggable');
  
          self._overlay.node().appendChild(circle);
          points.push(circle);
  
          // Add dragging functionality
          const dragHandler = (event: any) => {
            const tracker = event.eventSource;
            const webPoint = self._viewer.viewport.pointFromPixel(event.position);
            tracker.element.setAttribute('cx', webPoint.x.toString());
            tracker.element.setAttribute('cy', webPoint.y.toString());
            updatePolygon();
        };
          
          new OpenSeadragon.MouseTracker({
              element: circle,
              dragHandler: dragHandler
          }).setTracking(true); 
      });
  
      // Add polygon to SVG overlay
      self._overlay.node().appendChild(polygon);
  
      const updatePolygon = () => {
              const pointsAttr = points.map((point) => {
                  return point.getAttribute('cx') + ',' + point.getAttribute('cy');
              }).join(' ');

              polygon.setAttribute('points', pointsAttr);
          };

      updatePolygon();

    });
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

}


const webToViewport = (x: number, y: number, viewer: Viewer): Point => {
  const point = new Point(x, y);
  return viewer.viewport.pointFromPixel(point);
};
