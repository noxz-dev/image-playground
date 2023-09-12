import { EventHandler, MouseTracker, OSDEvent, Point, Viewer } from 'openseadragon';

export const SVG_ID = 'drawingSvg';
export const SOLUTION_NODE_ID = 'solutionNode';
export const USER_SOLUTION_NODE_ID = 'userSolutionNode';
export const BACKGROUND_NODE_ID = 'backgroundNode';
export const INFO_NODE_ID = 'infoNode';

// Adaption of: https://github.com/openseadragon/svg-overlay | License: BSD-3-Clause License
export class SvgOverlay {
  private static svgNS = 'http://www.w3.org/2000/svg';
  private _viewer: Viewer;
  private _containerWidth: number;
  private _containerHeight: number;
  private readonly _svg: HTMLElement;
  private readonly _node: HTMLElement;
  private readonly _infoNode: HTMLElement;

  constructor(viewer: Viewer) {
    const self = this;

    this._viewer = viewer;
    this._containerWidth = 0;
    this._containerHeight = 0;

    this._svg = document.createElementNS(SvgOverlay.svgNS, 'svg') as HTMLElement;
    this._svg.id = SVG_ID;
    this._svg.style.position = 'absolute';
    this._svg.style.left = '0';
    this._svg.style.top = '0';
    this._svg.style.width = '100%';
    this._svg.style.height = '100%';
    this._viewer.canvas.appendChild(this._svg);


    this._node = document.createElementNS(SvgOverlay.svgNS, 'g') as HTMLElement;
    this._node.id = SOLUTION_NODE_ID;
    this._svg.appendChild(this._node);

    this._infoNode = document.createElementNS(SvgOverlay.svgNS, 'g') as HTMLElement;
    this._infoNode.id = INFO_NODE_ID;
    this._svg.appendChild(this._infoNode);


    this._viewer.addHandler('animation', function () {
      self.resize();
    });

    this._viewer.addHandler('open', function () {
      self.resize();
    });

    this._viewer.addHandler('rotate', function () {
      self.resize();
    });

    this._viewer.addHandler('resize', function () {
      self.resize();
    });

    this.resize();
  }

  svg() {
    return this._svg;
  }

  node(): HTMLElement {
    return this._node;
  }


  infoNode(): HTMLElement {
    return this._infoNode;
  }

  resize() {
    if (this._containerWidth !== this._viewer.container.clientWidth) {
      this._containerWidth = this._viewer.container.clientWidth;
      this._svg.setAttribute('width', this._containerWidth + '');
    }

    if (this._containerHeight !== this._viewer.container.clientHeight) {
      this._containerHeight = this._viewer.container.clientHeight;
      this._svg.setAttribute('height', this._containerHeight + '');
    }

    const p = this._viewer.viewport.pixelFromPoint(new Point(0, 0), true);
    const zoom = this._viewer.viewport.getZoom(true);
    const rotation = this._viewer.viewport.getRotation();
    // @ts-ignore
    const scale = this._viewer.viewport._containerInnerSize.x * zoom;
    this._node.setAttribute(
      'transform',
      'translate(' + p.x + ',' + p.y + ') scale(' + scale + ') rotate(' + rotation + ')'
    );

    this._infoNode.setAttribute(
      'transform',
      'translate(' + p.x + ',' + p.y + ') scale(' + scale + ') rotate(' + rotation + ')'
    );

  }

  onClick(node: string | Element, handler: EventHandler<OSDEvent<any>>) {
    new MouseTracker({
      element: node,
      clickHandler: handler
    }).setTracking(true);
  }
}

declare module 'openseadragon' {
  interface Viewer {
    svgOverlay(): SvgOverlay;
  }
}

Viewer.prototype.svgOverlay = function () {
  return new SvgOverlay(this);
};
