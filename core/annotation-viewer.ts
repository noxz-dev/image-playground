import { select } from 'd3-selection';
import OpenSeadragon, { Point, Viewer } from 'openseadragon';
import { Annotation } from './svg/annotation/annotation';
import { AnnotationLine } from './svg/annotation/annotationLine';
import { AnnotationPoint } from './svg/annotation/annotationPoint';
import { AnnotationRectangle } from './svg/annotation/annotationRect';
import InfoAnnotationLine from './svg/annotation/info/infoAnnotationLine';
import InfoAnnotationPoint from './svg/annotation/info/infoAnnotationPoint';
import InfoAnnotationPolygon from './svg/annotation/info/infoAnnotationPolygon';
import { MouseCircle } from './svg/mouseCircle';
import { OffsetAnnotationLine } from './svg/annotation/offset/offsetAnnotationLine';
import { OffsetAnnotationPoint } from './svg/annotation/offset/offsetAnnotationPoint';
import { OffsetAnnotationRectangle } from './svg/annotation/offset/offsetAnnotationRect';
import { OffsetAnnotationPolygon } from './svg/annotation/offset/offsetAnnotationPolygon';
import { AnnotationPolygon } from './svg/annotation/annotationPolygon';
import { Task } from '../../model/task/task';
import { UserSolution, UserSolutionCreate } from '../../model/userSolution';
import { ANNOTATION_TYPE, isUserSolution } from './types/annotationType';
import { ANNOTATION_COLOR, getFillColor } from './types/colors';
import {
  ANNOTATION_OFFSET_SCALAR,
  POLYGON_INFLATE_OFFSET,
  POLYGON_SNAPPING_RADIUS,
  POLYGON_STROKE_WIDTH,
  POLYGON_VERTEX_COLOR
} from './config/defaultValues';
import { AnnotationData } from '../../model/viewer/export/annotationData';
import { AnnotationRectangleData } from '../../model/viewer/export/annotationRectangleData';
import { OffsetAnnotationPolygonData } from '../../model/viewer/export/offsetAnnotationPolygonData';
import { PointData } from '../../model/viewer/export/pointData';
import { AnnotationParser } from '../../utils/annotation-parser';
import { imageToViewport, pointIsInImage, webToViewport } from '../../utils/seadragon.utils';
import { TooltipGenerator } from '../../utils/tooltips/tooltip-generator';
import { snapAnnotation, SnapResult } from './helper/snapAnnotation';
import { AnnotationManager } from './annotationManager';
import { SVG_ID } from './config/generateViewerOptions';
import { SvgOverlay } from './svg-overlay';
import { TaskSaver } from './taskSaver';
import { viewerLoadingState, viewerScale, viewerZoom } from './viewerState';
import { focusAnnotation } from './helper/focusAnnotation';

export class AnnotationViewer {
  private _overlay: SvgOverlay;
  private _annotationManager: AnnotationManager;
  private _mouseCircle: MouseCircle;
  private _currentColor: ANNOTATION_COLOR;

  constructor(viewerOptions: OpenSeadragon.Options) {
    this._viewer = OpenSeadragon(viewerOptions);

    // @ts-ignore
    this._viewer.innerTracker.keyHandler = null;

    new OpenSeadragon.TileCache({
      maxImageCacheCount: 500
    });

    // Needs to be there, so opensedragon knows that the svg overlay exists
    new SvgOverlay(this._viewer);
    select('#' + SVG_ID).remove();
    this._overlay = this._viewer.svgOverlay();

    this._currentColor = ANNOTATION_COLOR.USER_SOLUTION_COLOR;
    viewerLoadingState.tilesLoaded = false;

    this._annotationManager = new AnnotationManager(
      this._overlay.solutionNode(),
      this._overlay.infoNode(),
    );

    this.addAnimationHandler();

    this._viewer.addHandler('open', () => {
      const opacity = this.zoom < 0.5 ? 0 : 1;

      this._annotationManager.updateAnnotation(opacity, this.scale);
      this._mouseCircle.updateScale(POLYGON_VERTEX_COLOR / this.scale, POLYGON_STROKE_WIDTH / this.scale);
      if (this._drawingAnnotation) {
        this._drawingAnnotation.update(POLYGON_VERTEX_COLOR / this.scale, POLYGON_STROKE_WIDTH / this.scale);
      }

      viewerZoom.value = this.zoom;
      viewerScale.value = this.scale;

      viewerLoadingState.tilesLoaded = true;

      this._viewer.viewport.zoomBy(1);
    });
  }

  private _viewer: OpenSeadragon.Viewer;

  get viewer(): Viewer {
    return this._viewer;
  }

  private _drawingAnnotation!: AnnotationLine | AnnotationRectangle | undefined;

  get drawingAnnotation() {
    return this._drawingAnnotation;
  }

  private _stopDraggingIndicator: boolean = false;

  set stopDraggingIndicator(value: boolean) {
    this._stopDraggingIndicator = value;
  }

  private _snapResult: SnapResult | undefined;

  get snapResult() {
    return this._snapResult;
  }

  get isLineDrawing() {
    return this._drawingAnnotation !== undefined && this._drawingAnnotation instanceof AnnotationLine;
  }

  get isPolygonDrawing() {
    return this._drawingAnnotation !== undefined && this._drawingAnnotation instanceof AnnotationPolygon;
  }

  get drawingPolygonIsClosed() {
    if (this._drawingAnnotation?.isClosed) {
      if (
        this._drawingAnnotation instanceof OffsetAnnotationPolygon ||
        this._drawingAnnotation instanceof OffsetAnnotationRectangle
      ) {
        const annotation = this._drawingAnnotation as OffsetAnnotationPolygon;

        let size = annotation.getSize();

        if (this._drawingAnnotation instanceof OffsetAnnotationRectangle) {
          size *= 1 / (size * 2) / 100;
        }

        const offset = POLYGON_INFLATE_OFFSET * size;

        const value = (offset * ANNOTATION_OFFSET_SCALAR) / 80;

        annotation.inflationInnerOffset = value;
        annotation.inflationOuterOffset = value;

        annotation.createInflation(this.scale);
      }
    }

    return this._drawingAnnotation?.isClosed;
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

  addAnimationHandler(): void {
    this._viewer.addHandler('animation', () => {
      TooltipGenerator.hideAll();

      const opacity = this.zoom < 0.5 ? 0 : 1;

      this._annotationManager.updateAnnotation(opacity, this.scale);
      this._mouseCircle.updateScale(POLYGON_VERTEX_COLOR / this.scale, POLYGON_STROKE_WIDTH / this.scale);
      if (this._drawingAnnotation) {
        this._drawingAnnotation.update(POLYGON_VERTEX_COLOR / this.scale, POLYGON_STROKE_WIDTH / this.scale);
      }

      viewerZoom.value = this.zoom;
      viewerScale.value = this.scale;
    });
  }

  /**
   * Converts annotation in an XML-File to Annotation objects
   *
   * @param file XML-File with annotations
   * @param callback Function to execute when annotation are convertet
   */
  convertToAnnotations(file: Blob | File, callback: (data: any) => void): void {
    AnnotationParser.convertXmlToPolygons(file as File, this._viewer, callback);
  }

  /**
   * Adds a new drawing annotation
   *
   * @param type Annotation type
   */
  addDrawingAnnotation(type: ANNOTATION_TYPE): void {
    if (this._drawingAnnotation?.isClosed) {
      this._drawingAnnotation = undefined;
      return;
    }
    if (!this._drawingAnnotation) {
      let node: HTMLElement;

      if (type === ANNOTATION_TYPE.BASE) {
        node = this._annotationManager.backgroundNode;
      } else if (isUserSolution(type)) {
        node = this._annotationManager.userSolutionNode;
      } else {
        node = this._annotationManager.solutionNode;
      }

      switch (type) {
        case ANNOTATION_TYPE.SOLUTION:
          this._drawingAnnotation = new OffsetAnnotationPolygon(
            node,
            type,
            this._currentColor + ANNOTATION_COLOR.FILL_OPACITY,
            this._currentColor,
            (POLYGON_INFLATE_OFFSET / this.scale) * ANNOTATION_OFFSET_SCALAR,
            (POLYGON_INFLATE_OFFSET / this.scale) * ANNOTATION_OFFSET_SCALAR
          );
          break;
        case ANNOTATION_TYPE.SOLUTION_LINE:
          this._drawingAnnotation = new OffsetAnnotationLine(
            node,
            type,
            this._currentColor,
            (POLYGON_INFLATE_OFFSET / this.scale) * ANNOTATION_OFFSET_SCALAR
          );
          break;
        case ANNOTATION_TYPE.USER_SOLUTION_LINE:
          this._drawingAnnotation = new AnnotationLine(node, type, this._currentColor);
          break;
        case ANNOTATION_TYPE.USER_SOLUTION_RECT:
          this._drawingAnnotation = new AnnotationRectangle(
            node,
            type,
            this._currentColor + ANNOTATION_COLOR.FILL_OPACITY,
            this._currentColor
          );
          break;

        case ANNOTATION_TYPE.SOLUTION_RECT:
          this._drawingAnnotation = new OffsetAnnotationRectangle(
            node,
            type,
            this._currentColor + ANNOTATION_COLOR.FILL_OPACITY,
            this._currentColor,
            (POLYGON_INFLATE_OFFSET / this.scale) * ANNOTATION_OFFSET_SCALAR,
            (POLYGON_INFLATE_OFFSET / this.scale) * ANNOTATION_OFFSET_SCALAR
          );
          break;
        case ANNOTATION_TYPE.BASE:
          // this._drawingAnnotation = new AnnotationPolygon(node, type, 'none', this._currentColor);
          this._drawingAnnotation = new AnnotationRectangle(node, type, 'none', this._currentColor);
          break;
        case ANNOTATION_TYPE.INFO_LINE:
          this._drawingAnnotation = new InfoAnnotationLine(
            '',
            '',
            [],
            this._annotationManager.backgroundNode,
            ANNOTATION_TYPE.INFO_LINE
          );
          break;
        case ANNOTATION_TYPE.INFO_POLYGON:
          this._drawingAnnotation = new InfoAnnotationPolygon(
            '',
            '',
            [],
            this._annotationManager.backgroundNode,
            ANNOTATION_TYPE.INFO_POLYGON,
            this._currentColor + ANNOTATION_COLOR.FILL_OPACITY,
            this._currentColor
          );
          break;

        default:
          this._drawingAnnotation = new AnnotationPolygon(
            node,
            type,
            this._currentColor + ANNOTATION_COLOR.FILL_OPACITY,
            this._currentColor
          );
      }
    }
  }

  /**
   * Removes the drawing annotation
   */
  removeDrawingAnnotation(): void {
    this._drawingAnnotation?.remove();
    this._drawingAnnotation = undefined;
  }

  /**
   * Unsets the drawing annotation
   */
  unsetDrawingAnnotation() {
    this._drawingAnnotation = undefined;
  }

  /**
   * Updaete the drawing annotation
   */
  updateDrawingAnnotation(): void {
    if (!this._drawingAnnotation) return;
    const viewportPoint = new Point(this._mouseCircle.cx, this._mouseCircle.cy);
    if (pointIsInImage(viewportPoint, this._viewer)) {
      this._drawingAnnotation.addVertex(
        viewportPoint,
        POLYGON_VERTEX_COLOR / this.scale,
        POLYGON_STROKE_WIDTH / this.scale
      );

      if (this._drawingAnnotation.isClosed) {
        this._annotationManager.pushAnnotation(this._drawingAnnotation);
      }
    }
  }

  /**
   * Updates the drawing annotation indicator
   */
  updateDrawingAnnotationIndicator(annotationTypes: ANNOTATION_TYPE[], snap: boolean = false): void {
    if (snap) {
      let annotations: Annotation[] = [];
      annotationTypes.forEach((type) =>
        this._annotationManager.getAnnotations(type).forEach((annotation) => annotations.push(annotation))
      );
      this._snapResult = snapAnnotation(annotations, new Point(this._mouseCircle.cx, this._mouseCircle.cy), this.scale);
      if (this._snapResult) {
        if (this._snapResult.distance) {
          this._mouseCircle.updateCx(this._snapResult.snapPoint.x);
          this._mouseCircle.updateCy(this._snapResult.snapPoint.y);
          this._mouseCircle.updateFillColor(this._snapResult.selectedAnnotation.color);
          this._mouseCircle.updateStrokeColor(this._snapResult.selectedAnnotation.color);
        }
      } else {
        this._mouseCircle.updateFillColor(getFillColor(ANNOTATION_COLOR.BACKGROUND_COLOR));
        this._mouseCircle.updateStrokeColor(ANNOTATION_COLOR.BACKGROUND_COLOR);
      }
    }

    if (!this._drawingAnnotation || this._drawingAnnotation.vertice.length < 1 || this._stopDraggingIndicator) return;

    if (this._drawingAnnotation instanceof AnnotationPolygon) {
      const firstPoint = this._drawingAnnotation.vertice[0];
      const x = this._mouseCircle.cx;
      const y = this._mouseCircle.cy;
      const xDiff = (x - firstPoint.viewport.x) * (x - firstPoint.viewport.x);
      const yDiff = (y - firstPoint.viewport.y) * (y - firstPoint.viewport.y);
      if (xDiff + yDiff < POLYGON_VERTEX_COLOR / (this.scale * (this.scale / POLYGON_SNAPPING_RADIUS))) {
        this._mouseCircle.updatePosition(firstPoint.viewport.x, firstPoint.viewport.y);
      }
    }
    this._drawingAnnotation.updatePolyline(this._mouseCircle.cx, this._mouseCircle.cy);
  }

  removeLastVertex() {
    if (this._drawingAnnotation instanceof AnnotationLine) {
      this._drawingAnnotation.popLastVertex();
      this._drawingAnnotation.updatePolyline(this._mouseCircle.cx, this._mouseCircle.cy);
    }
  }

  /**
   * Adds new annotation point
   */
  addUserAnnotationPoint(): void {
    select(this._annotationManager.userSolutionNode)
      .append('circle')
      .attr('cx', this._mouseCircle.cx)
      .attr('cy', this._mouseCircle.cy)
      .attr('r', POLYGON_VERTEX_COLOR / this.scale)
      .attr('stroke-width', POLYGON_STROKE_WIDTH / this.scale)
      .style('fill', 'red');
  }

  /**
   * Adds a new offset annotation point
   *
   * @param type Annotation type
   * @param x X position
   * @param y Y position
   * @param task Task to add the offset annotation point to
   */
  async addOffsetAnnotationPoint(type: ANNOTATION_TYPE, x: number, y: number, task: Task) {
    const annotationPoint = new OffsetAnnotationPoint(
      this._annotationManager.getNode(type),
      type,
      (POLYGON_INFLATE_OFFSET / this.scale) * ANNOTATION_OFFSET_SCALAR,
      this._currentColor
    );
    const viewport = webToViewport(x, y, this._viewer);
    annotationPoint.setPoint(viewport, POLYGON_VERTEX_COLOR / this.scale, POLYGON_STROKE_WIDTH / this.scale);
    this._annotationManager.pushAnnotation(annotationPoint);
    await this.saveTaskAnnotation(task, annotationPoint);
    return annotationPoint;
  }

  /**
   * Adds a new info annotation
   *
   * @param x X Position
   * @param y Y Position
   * @param task Task to add the info annotation to
   * @returns The created and saved info annotation
   */
  async addInfoAnnotationPoint(x: number, y: number, task: Task): Promise<Annotation> {
    const point = new InfoAnnotationPoint(
      '',
      '',
      [],
      this._annotationManager.backgroundNode,
      ANNOTATION_TYPE.INFO_POINT
    );
    const viewport = webToViewport(x, y, this._viewer);
    point.setPoint(viewport, POLYGON_VERTEX_COLOR / this.scale, POLYGON_STROKE_WIDTH / this.scale);
    this._annotationManager.pushAnnotation(point);
    await this.saveTaskAnnotation(task, point);
    return point;
  }

  async updateInfoAnnotation(
    id: string,
    headerText: string,
    detailText: string,
    images: string[],
    task: Task
  ): Promise<Annotation> {
    const annotation = this._annotationManager.getInfoAnnotation(id)!;

    const infoAnnotation = annotation as InfoAnnotationPoint;
    infoAnnotation.headerText = headerText;
    infoAnnotation.detailText = detailText;
    infoAnnotation.images = images;
    await this.updateAnnotation(task, infoAnnotation);
    return infoAnnotation;
  }

  /**
   * Create a new annotation point
   *
   * @param type Annotation type
   * @param x X position
   * @param y Y position
   * @returns The created annotation point
   */
  addAnnotationPoint(type: ANNOTATION_TYPE, x: number, y: number) {
    const annotationPoint = new AnnotationPoint(this._annotationManager.getNode(type), type);
    const viewport = webToViewport(x, y, this._viewer);
    annotationPoint.setPoint(viewport, POLYGON_VERTEX_COLOR / this.scale, POLYGON_STROKE_WIDTH / this.scale);
    this._annotationManager.pushAnnotation(annotationPoint);
    return annotationPoint;
  }

  /**
   * Adds the given serialized background annotations
   *
   * @param data Serialized background annotations
   */
  addBackgroundPolygons(data: AnnotationData[]) {
    this.addAnnotations(data);
  }

  /**
   * Clears solution annotations
   */
  clearSolutionAnnotations(): void {
    this._annotationManager.clearSolutionAnnotations();
  }

  clearBackgroundAnnotations(): void {
    this._annotationManager.clearBackgroundAnnotations();
  }

  clearUserAnnotations(): void {
    this._annotationManager.clearUserAnnotations();
    select('#' + SVG_ID)
      .selectAll('#' + this._overlay.userSolutionNode().id + ' > *')
      .remove();
  }

  /**
   * Clear all annotations
   */
  clear(): void {
    this._annotationManager.clear();
    select('#' + SVG_ID)
      .selectAll('g > *')
      .remove();
    if (this._mouseCircle.isAttached) {
      this._mouseCircle.removeCircle();
      this._mouseCircle.appendCircle(POLYGON_VERTEX_COLOR / this.scale, POLYGON_STROKE_WIDTH / this.scale);
    }
  }

  /**
   * Stops the drawing
   *
   * @returns The drawing annotation
   */
  stopDrawing(): Annotation | undefined {
    if (this._drawingAnnotation) {
      if (this._drawingAnnotation.vertice.length > 1) {
        if (this._drawingAnnotation! instanceof OffsetAnnotationLine) {
          (this._drawingAnnotation as OffsetAnnotationLine).createInflation(this.scale);
        }

        this._drawingAnnotation!.isClosed = true;
        this._drawingAnnotation!.redrawPolyline();
        this._annotationManager.pushAnnotation(this._drawingAnnotation!);
      }
    }
    return this._drawingAnnotation;
  }

  /**
   * Adds the given serialized annotations
   *
   * @param data The serialized annotations
   */
  addAnnotations(data: AnnotationData[]): void {
    if (data.length === 0) return;

    let dataInstance = data as OffsetAnnotationPolygonData[];
    for (const item of data) {
      const items: PointData[] = [];
      item.coord.image.forEach((point: PointData) => {
        let i = imageToViewport(new Point(point.x, point.y), this._viewer);
        const ks: PointData = {
          x: i.x,
          y: i.y
        };
        items.push(ks);
      });
      item.coord.viewport = items;
    }
    if (dataInstance[0]?.innerPoints || dataInstance[0].outerPoints) {
      for (const item of dataInstance) {
        if (item.innerPoints) {
          const innerPointData: PointData[] = [];
          item.innerPoints.image.forEach((point: PointData) => {
            let i = imageToViewport(new Point(point.x, point.y), this._viewer);
            const ks: PointData = {
              x: i.x,
              y: i.y
            };
            innerPointData.push(ks);
          });

          item.innerPoints.viewport = innerPointData;
        }

        if (item.outerPoints) {
          const outerPointData: PointData[] = [];
          item.outerPoints.image.forEach((point: PointData) => {
            let i = imageToViewport(new Point(point.x, point.y), this._viewer);
            const ks: PointData = {
              x: i.x,
              y: i.y
            };
            outerPointData.push(ks);
          });

          item.outerPoints.viewport = outerPointData;
        }
      }
      this._annotationManager.addAnnotation(dataInstance, this.scale);
    } else {
      this._annotationManager.addAnnotation(data as AnnotationRectangleData[], this.scale);
    }
  }

  parseUserSolutionAnnotations(solutionData: AnnotationData[], editable: boolean) {
    for (const data of solutionData) {
      const points: PointData[] = [];
      data.coord.image.forEach((point: PointData) => {
        let viewportPoint = imageToViewport(new Point(point.x, point.y), this._viewer);
        const viewportPointData: PointData = {
          x: viewportPoint.x,
          y: viewportPoint.y
        };
        points.push(viewportPointData);
      });
      data.coord.viewport = points;
    }
    const annotations = this._annotationManager.addAnnotation(solutionData, this.scale, editable);
    return annotations;
  }

  addUserSolutionAnnotations(annotations: Annotation[]) {
    this._annotationManager.userSolutionAnnotations.push(...annotations);
    annotations.forEach((annotation) =>
      annotation.redraw(POLYGON_VERTEX_COLOR / this.scale, POLYGON_STROKE_WIDTH / this.scale)
    );
  }

  removeUserAnnotations(annotations: Annotation[]) {
    for (const annotation of annotations) {
      this._annotationManager.deleteUserAnnotationFromImage(annotation);
      annotation.unselect();
      annotation.remove();
    }
  }

  /**
   * Appends mouse circle
   */
  appendMouseCirlce(): void {
    this._mouseCircle.appendCircle(POLYGON_VERTEX_COLOR / this.scale, POLYGON_STROKE_WIDTH / this.scale);
  }

  /**
   * Removes the mouse cirlce
   */
  removeMouseCircle(): void {
    if (this._mouseCircle.isAttached) {
      this._mouseCircle.removeCircle();
    }
  }

  /**
   * Updates the mouse circle position
   *
   * @param x X position
   * @param y Y position
   */
  update(x: number, y: number): void {
    const viewport = webToViewport(x, y, this._viewer);

    if (this._mouseCircle.isAttached) {
      this._mouseCircle.updatePosition(viewport.x, viewport.y);
    }
  }

  /**
   * Changes the color of the drawing annotation
   *
   * @param color New color
   */
  updateColor(color: ANNOTATION_COLOR) {
    this._currentColor = color;

    this._mouseCircle.updateFillColor(this._currentColor + ANNOTATION_COLOR.FILL_OPACITY);
    this._mouseCircle.updateStrokeColor(this._currentColor);
    this._drawingAnnotation?.updateColor(this._currentColor, this._currentColor);
  }

  /**
   * Updates the type of the annotation
   *
   * @param type Annotation type
   */
  updateType(type: ANNOTATION_TYPE) {
    if (this._drawingAnnotation) {
      this._drawingAnnotation.type = type;
    }
  }

  /**
   * Saves the given task
   *
   * @param task Task to save
   * @param type Annotation type
   * @returns Promise with the saved task
   */
  save(task: Task, type = this._drawingAnnotation?.type): Promise<Task> | undefined {
    if (type !== undefined) {
      return TaskSaver.update(task, this._annotationManager.getAnnotations(type), type, this._viewer);
    }
  }

  /**
   * Saves a new task solution annotation
   *
   * @param task Task to save
   * @param annotation Annotation to save
   * @returns Promise with save status
   */
  saveTaskAnnotation(task: Task, annotation?: Annotation): Promise<any> {
    if (annotation) {
      return TaskSaver.saveTaskAnnotation(task, annotation, this.viewer);
    }
    const tempAnnotation = this._drawingAnnotation!;
    return TaskSaver.saveTaskAnnotation(task, tempAnnotation, this.viewer);
  }

  /**
   * Saves a new user solution annotation
   *
   * @param task Task to save
   * @param annotation Annotation to save
   * @returns Promise with save status
   */
  saveUserAnnotation(task: Task, annotation?: Annotation): Promise<any> {
    return TaskSaver.saveUserAnnotation(task, this._drawingAnnotation || annotation!, this._viewer);
  }

  /**
   * Saves a new user solution
   *
   * @param create Content to create the user solution
   * @param type Annotation type
   * @returns Promise with the user solution
   */
  saveUserSolution(create: UserSolutionCreate, type?: ANNOTATION_TYPE): Promise<UserSolution> {
    return TaskSaver.saveUserSolution(
      create,
      this._annotationManager.getAnnotations(type || this._drawingAnnotation!.type),
      this._viewer
    );
  }

  /**
   * Updates the given annotation
   *
   * @param task Task to update
   * @param annotation Annotation to update
   * @returns Promise with the update status
   */
  updateAnnotation(task: Task, annotation: Annotation): Promise<any> {
    return TaskSaver.updateAnnotation(task, annotation, this._viewer);
  }

  updateAnnotationClass(id: string, className: string, classColor: string): Annotation | undefined {
    const annotation = this._annotationManager.getAnnotationById(id);

    annotation?.updateAnnotationClass(className, classColor);

    return annotation;
  }

  /**
   * Updates the given use solution annotation
   *
   * @param task Task to update
   * @param annotation Annotation to update
   * @returns Promise with update status
   */
  updateUserAnnotation(task: Task, annotation: Annotation): Promise<any> {
    return TaskSaver.updateUserAnnotation(task, annotation, this._viewer);
  }

  /**
   * Delets the annotation to the given ID
   *
   * @param task Task to delte annotation from
   * @param selectionId ID of the annotation
   * @returns Promise with the delete status
   */
  async deleteAnnotationByID(task: Task, selectionId: string): Promise<any> {
    let annotation: Annotation;
    this._annotationManager.backgroundAnnotations.forEach((element: Annotation, index: number) => {
      if (element.id === selectionId) {
        annotation = this._annotationManager.backgroundAnnotations.splice(index, 1)[0];
        annotation.remove();
        return;
      }
    });

    this._annotationManager.userSolutionAnnotations.forEach((element: Annotation, index: number) => {
      if (element.id === selectionId) {
        annotation = this._annotationManager.userSolutionAnnotations.splice(index, 1)[0];
        annotation.remove();
        return;
      }
    });

    this._annotationManager.solutionAnnotations.forEach((element: Annotation, index: number) => {
      if (element.id === selectionId) {
        annotation = this._annotationManager.solutionAnnotations.splice(index, 1)[0];
        annotation.remove();

        return;
      }
    });

    this._annotationManager.infoAnnotations.forEach((element: Annotation, index: number) => {
      if (element.id === selectionId) {
        annotation = this._annotationManager.infoAnnotations.splice(index, 1)[0];
        annotation.remove();

        return;
      }
    });

    if (annotation!) {
      return await TaskSaver.deleteAnnotation(task, annotation);
    }
  }

  /**
   * Delets the given user solution annotation by its ID
   *
   * @param task Task to delete annotation from
   * @param selectionId ID of the user solution annotation
   * @returns Promise with delete status
   */
  deleteUserSolution(task: Task, selectionId: string) {
    let polygon: Annotation;
    this._annotationManager.userSolutionAnnotations.forEach((element: Annotation, index: number) => {
      if (element.id === selectionId) {
        polygon = this._annotationManager.userSolutionAnnotations.splice(index, 1)[0];
      }
    });

    if (polygon!) {
      return TaskSaver.deleteUserAnnotation(task, polygon.id);
    }
  }

  /**
   * Removes all SVG listener
   */
  removeListener() {
    select('#' + SVG_ID)
      .selectAll('*')
      .selectAll('polyline, circle, path, rect')
      .on('click', null);
  }

  /**
   * Selects an annotation
   *
   * @param annotationId ID of the annotation to select
   * @param trackable If the Annotation should be trackable
   * @returns The selected annotation
   */
  selectAnnotation(annotationId: string, trackable: boolean = false): Annotation {
    const polygon = this._annotationManager.findByIdAndUnselect(annotationId);

    if (polygon) {
      polygon.select(this._viewer, this.scale, trackable);
      focusAnnotation(polygon, this._viewer);
    }

    return polygon;
  }

  /**
   * Resets annotations
   */
  resetAnnotations(): void {
    for (const polygon of this._annotationManager.userSolutionAnnotations) {
      if (polygon instanceof AnnotationLine || polygon instanceof AnnotationRectangle) {
        (polygon as AnnotationLine).removeResultPolylines();
      }
      polygon.resetColors();
    }
  }

  resetUserAnnotations(annotations: Annotation[]) {
    for (const annotation of annotations) {
      if (annotation instanceof AnnotationLine || annotation instanceof AnnotationRectangle) {
        (annotation as AnnotationLine).removeResultPolylines();
      }
      annotation.resetColors();
    }
  }

  /**
   * Changes the annotation color
   *
   * @param annotationID ID of the annotation
   * @param color Color to update to
   */
  changeAnnotationColorById(annotationID: string, color: string): void {
    this._annotationManager
      .getAnnotationById(annotationID)
      ?.changeRenderColor(color + ANNOTATION_COLOR.FILL_OPACITY, color);
  }

  /**
   * Changes all user annotations colors
   * @param color New color
   */
  changeAllUserAnnotationColor(color: string): void {
    for (const annotation of this._annotationManager.userSolutionAnnotations) {
      this.changeAnnotationColor(color, annotation);
    }
  }

  changeUserAnnotationColor(color: string, annotations: Annotation[]) {
    for (const annotation of annotations) {
      this.changeAnnotationColor(color, annotation);
    }
  }

  private changeAnnotationColor(color: string, annotation: Annotation) {
    annotation.changeRenderColor(color + ANNOTATION_COLOR.FILL_OPACITY, color);
  }

  /**
   * Adds a polyline to the given annotation
   *
   * @param id Id of the anbnotation
   * @param points Points of the polyline
   */
  addPolyline(id: string, points: number[][][]): void {
    const annotation = this._annotationManager.getAnnotationById(id);

    if (annotation instanceof AnnotationLine || annotation instanceof AnnotationRectangle) {
      for (let i = 0; i < points.length; i++) {
        const line = points[i];
        const resultPoints = line.map((lineItem) => {
          const viewPoint = imageToViewport(new Point(lineItem[0], lineItem[1]), this.viewer);
          return viewPoint.x + ',' + viewPoint.y;
        });

        (annotation as AnnotationLine).addResultPolyline(resultPoints, POLYGON_STROKE_WIDTH / this.scale);
      }
    }
  }

  addVertexToAnnotation(): Annotation | undefined {
    if (this._snapResult) {
      const { snapPoint, indexToInsertAfter, selectedAnnotation } = this._snapResult;
      (selectedAnnotation as AnnotationLine).addVertexInBetween(
        snapPoint,
        indexToInsertAfter + 1,
        POLYGON_VERTEX_COLOR / this.scale,
        POLYGON_STROKE_WIDTH / this.scale
      );

      return selectedAnnotation;
    }
    return undefined;
  }

  focusBackgroundAnnotation(index: number): void {
    if (
      this._annotationManager.backgroundAnnotations.length == 0 ||
      index > this._annotationManager.backgroundAnnotations.length
    ) {
      return;
    }
    focusAnnotation(this._annotationManager.backgroundAnnotations[index], this._viewer);
  }

  convertBackgroundAnnotationToSolutionAnnotation(annotation: AnnotationRectangle) {
    const vertexElements = annotation.getAllVertices();
    const newAnnotation = new OffsetAnnotationPolygon(
      this._annotationManager.solutionNode,
      ANNOTATION_TYPE.SOLUTION,
      ANNOTATION_COLOR.SOLUTION_COLOR + ANNOTATION_COLOR.FILL_OPACITY,
      ANNOTATION_COLOR.SOLUTION_COLOR,
      (POLYGON_INFLATE_OFFSET / this.scale) * ANNOTATION_OFFSET_SCALAR,
      (POLYGON_INFLATE_OFFSET / this.scale) * ANNOTATION_OFFSET_SCALAR
    );
    newAnnotation.addClosedInsetPolygonFromPoints(vertexElements, this.scale);

    this._annotationManager.pushSolutionAnnotation(newAnnotation);
    return newAnnotation;
  }

  convertSolutionAnnotationToBackgroundAnnotation(annotation: OffsetAnnotationPolygon) {
    const bbox = annotation.getBoundingBox();

    const rectangle = new AnnotationRectangle(
      this._annotationManager.backgroundNode,
      ANNOTATION_TYPE.BASE,
      'none',
      ANNOTATION_COLOR.BACKGROUND_COLOR
    );
    rectangle.width = bbox!.width;
    rectangle.height = bbox!.height;

    rectangle.addClosedRectangle(
      [new Point(bbox!.x, bbox!.y)],
      POLYGON_VERTEX_COLOR / this.scale,
      POLYGON_STROKE_WIDTH / this.scale
    );

    this._annotationManager.pushAnnotation(rectangle);

    return rectangle;
  }

  resetZoom() {
    this._viewer.viewport.fitBounds(this._viewer.viewport.getHomeBounds());
  }
}
