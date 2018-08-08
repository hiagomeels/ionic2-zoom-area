import { Component, ViewChild, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Gesture, Content, RootNode } from 'ionic-angular';
import { ZoomAreaProvider } from './zoom-area.provider';

@Component({
  selector: 'zoom-area',
  template: `
    <ion-content>
      <div #zoomAreaRoot class="zoom" (click)="toggleZoomControls()">
        <div class="fit">
          <ng-content></ng-content>
        </div>
      </div>

      <ion-fab right top [@visibilityChanged]="zoomControlsState">
        <button (click)="zoomIn()" ion-fab color="primary" class="btn-zoom">
            <ion-icon name="add-circle"></ion-icon>
        </button>

        <button (click)="zoomOut()" ion-fab color="primary" class="btn-zoom">
            <ion-icon name="remove-circle"></ion-icon>
        </button>

        <button (click)="zoomReset()" ion-fab color="primary" class="btn-zoom">
            <ion-icon name="md-contract"></ion-icon>
        </button>
      </ion-fab>
    </ion-content>
`,
  animations: [
    trigger('visibilityChanged', [
      state('shown', style({ opacity: 1, display: 'block' })),
      state('hidden', style({ opacity: 0, display: 'none' })),
      transition('shown => hidden', animate('300ms')),
      transition('hidden => shown', animate('300ms')),
    ])
  ]
})
export class ZoomAreaComponent implements OnChanges {
  @ViewChild('zoomAreaRoot') zoom;
  @ViewChild(Content) content: Content;

  @Output() afterZoomIn = new EventEmitter<any>();
  @Output() afterZoomOut = new EventEmitter<any>();

  @Input() controls: boolean;
  @Output() controlsChanged = new EventEmitter<boolean>();

  @Input() scale: number;
  @Output() scaleChanged = new EventEmitter<number>();

  zoomControlsState;
  zoomRootElement;
  gesture;

  constructor(
    public zoomAreaProvider: ZoomAreaProvider
  ) {
    this.zoomControlsState = 'hidden';
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('controls' in changes) {
      let showControls = changes['controls'];

      if (showControls && showControls.currentValue) {
        this.zoomControlsState = 'shown';
      } else {
        this.zoomControlsState = 'hidden';
      }
    }

    if ('scale' in changes) {
      let scaleValue = changes['scale'];
      if (scaleValue && scaleValue.currentValue && scaleValue.currentValue === 1) {
        this.zoomReset();
      }
    }
  }

  ngAfterViewInit() {
    this.content.ionScroll.subscribe((data) => {
      this.zoomAreaProvider.notifyScroll(data);
    });

    this._pinchZoom(this.zoom.nativeElement, this.content);

    // Watch for user setCenter call
    let self = this;
    this.zoomAreaProvider.centerChanged$.subscribe(coords => {
      if (self.zoomConfig.scale === 1) {
        return;
      }

      self.setCoor(coords.x, coords.y);
      self.transform(coords.x, coords.y);
    });
  }

  zoomConfig = {
    original_x: 0,
    original_y: 0,
    max_x: 0,
    max_y: 0,
    x: 0,
    y: 0,
    last_x: 0,
    last_y: 0,
    scale: 1,
    last_scale: 1,
    max_scale: 4,
    min_scale: 1,
    header_height: 56
  };

  toggleZoomControls() {
    // this.zoomControlsState = this.zoomControlsState === 'shown' ? 'hidden' : 'shown';
    this.zoomControlsState = 'hidden';
  }

  zoomIn() {
    this.zoomConfig.scale += 1;

    if (this.zoomConfig.scale > 1) {
      this.zoomAreaProvider.notifyScrollState(this.zoomAreaProvider.SCROLL_STATE.COLAPSED);
    }

    if (this.zoomConfig.scale > this.zoomConfig.max_scale) {
      this.zoomConfig.scale = this.zoomConfig.max_scale;
    }

    this.transform();
    this.afterZoomIn.emit();
  }

  zoomOut(reset?) {
    if (!this.zoomRootElement) {
      return;
    }

    this.zoomConfig.scale -= 1;

    if (this.zoomConfig.scale < this.zoomConfig.min_scale) {
      this.zoomConfig.scale = this.zoomConfig.min_scale;
    }

    if (this.zoomConfig.scale === this.zoomConfig.min_scale) {
      reset = true;
      this.zoomAreaProvider.notifyScrollState(this.zoomAreaProvider.SCROLL_STATE.NORMAL);
    }

    reset ? this.transform(0.1, 0.1) : this.transform();

    this.afterZoomOut.emit();
  }

  zoomReset() {
    this.zoomConfig.scale = this.zoomConfig.min_scale;
    if (this.content && this.content.scrollTop) {
      this.content.scrollTop = 0;
    }
    this.zoomOut(true);
  }

  private _pinchZoom(elm: HTMLElement, content: Content): void {
    this.zoomRootElement = elm;
    this.gesture = new Gesture(this.zoomRootElement);

    this.zoomConfig.original_x = this.zoom.nativeElement.clientWidth;
    this.zoomConfig.original_y = this.zoom.nativeElement.clientHeight;
    let headers = document.getElementsByTagName("ion-header");
    let header_height = headers[headers.length - 1].clientHeight;
    if (this.zoomConfig.header_height !== header_height) {
      console.warn("header is not default height");
    }
    this.zoomConfig.header_height = header_height;
    this.zoomConfig.max_x = this.zoomConfig.original_x;
    this.zoomConfig.max_y = this.zoomConfig.original_y;
    this.zoomConfig.last_scale = this.zoomConfig.scale;

    this.gesture.listen();
    this.gesture.on('pan', this.onPan.bind(this));
    this.gesture.on('panend', this.onPanend.bind(this));
    this.gesture.on('pancancel', this.onPanend.bind(this));
    this.gesture.on('doubletap', this.onDoubleTap.bind(this));
    // this.gesture.on('tap', this.onTap.bind(this));
    this.gesture.on('pinch', this.onPinch.bind(this));
    this.gesture.on('pinchend', this.onPinchend.bind(this));
    this.gesture.on('pinchcancel', this.onPinchend.bind(this));
  }

  onPan(ev) {
    this.setCoor(ev.deltaX, ev.deltaY);
    this.setBounds();
    this.transform();
  }

  onPanend() {
    this.zoomConfig.last_x = this.zoomConfig.x < this.zoomConfig.max_x ? this.zoomConfig.x : this.zoomConfig.max_x;
    this.zoomConfig.last_y = this.zoomConfig.y < this.zoomConfig.max_y ? this.zoomConfig.y : this.zoomConfig.max_y;
  }

  onTap(ev) {
  }

  onDoubleTap(ev) {
    this.zoomConfig.last_x = 0;
    this.zoomConfig.last_y = 0;
    this.setCoor(0, 0);
    this.zoomConfig.scale = 1;
    this.zoomConfig.last_scale = 1;
    this.setBounds();
    this.transform();
  }

  // TODO- I thought the h should be the element's scrollHeight, howeverthe now it is only working on original_y
  // Maybe it is becasue of the css settings
  // zoom-area .zoom {
  // width: 100% !important;
  // height: 100% !important;
  // }
  // Changing this may affect other stuff
  onPinch(ev) {
    let z = this.zoomConfig;
    let last_scale = z.scale
    z.scale = Math.max(z.min_scale, Math.min(z.last_scale * ev.scale, z.max_scale));

    //Vector Focusing Feature
    //(a,b) is the new (x,y) after rectangle center scalling by k
    // a = k(x-w/2)+w/2
    // b = k(x-h/2)+h/2
    let k = z.scale / last_scale
    let x = ev.center.x;
    let y = ev.center.y - z.header_height - z.y;

    let a = k * (x - z.original_x / 2) + z.original_x / 2;
    let b = k * (y - z.original_y / 2) + z.original_y / 2;

    let dx = a - x;
    let dy = b - y;

    z.x = z.x - dx;
    z.y = z.y - dy;

    this.setBounds();
    this.transform();
  }

  onPinchend(ev) {
    let z = this.zoomConfig;
    z.last_scale = z.scale;
    z.last_x = z.x;
    z.last_y = z.y;
  }

  setBounds() {
    // optimise scale 1 instance
    let z = this.zoomConfig;

    if (z.scale == 1) {
      z.x = 0;
      if (z.y >= 0) {
        z.y = 0;
      } else {
        z.max_y = this.zoom.nativeElement.scrollHeight - this.zoom.nativeElement.clientHeight + z.header_height * 2;
        if (z.y < -z.max_y) {
          z.y = -z.max_y;
        }
      }
    } else {
      z.max_x = Math.ceil(this.zoom.nativeElement.clientWidth * (z.scale - 1) / 2);
      if (z.x < -z.max_x) {
        z.x = -z.max_x;
      } else if (z.x > z.max_x) {
        z.x = z.max_x;
      }
      z.max_y = Math.ceil(z.scale * this.zoom.nativeElement.scrollHeight - this.zoom.nativeElement.clientHeight * (z.scale + 1) / 2) + z.header_height * 2;
      var y_top_offset = Math.ceil(this.zoom.nativeElement.clientHeight * (z.scale - 1) / 2);
      if (z.y < -z.max_y) {
        z.y = -z.max_y;
      } else if (z.y > y_top_offset) {
        z.y = y_top_offset
      }
    }
  }

  setCoor(xx: number, yy: number) {
    this.zoomConfig.x = this.zoomConfig.last_x + xx;
    this.zoomConfig.y = this.zoomConfig.last_y + yy;
  }

  transform(xx?: number, yy?: number) {
    this.zoomRootElement.style.transform = `translate3d(${xx || this.zoomConfig.x}px, ${yy || this.zoomConfig.y}px, 0) scale3d(${this.zoomConfig.scale}, ${this.zoomConfig.scale}, 1)`;
  }
}
