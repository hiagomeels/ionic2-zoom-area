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
    ow: 0,
    oh: 0,
    original_x: 0,
    original_y: 0,
    max_x: 0,
    max_y: 0,
    min_x: 0,
    min_y: 0,
    x: 0,
    y: 0,
    last_x: 0,
    last_y: 0,
    scale: 1,
    last_scale: 1,
    center: { x: null, y: null },
    max_scale: 4,
    min_scale: 1,
    scale_threshold : 0.2
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
    this.zoomConfig.max_x = this.zoomConfig.original_x;
    this.zoomConfig.max_y = this.zoomConfig.original_y;
    this.zoomConfig.last_scale = this.zoomConfig.scale;

    this.gesture.listen();
    this.gesture.on('pan', this.onPan.bind(this));
    this.gesture.on('panend', this.onPanend.bind(this));
    this.gesture.on('pancancel', this.onPanend.bind(this));
    this.gesture.on('doubletap',this.onDoubleTap.bind(this));
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
    this.zoomConfig.center = { x: null, y: null };
  }

  onTap(ev) {
    // if (ev && ev.tapCount > 1) {
    //   let reset = false;
    //   this.zoomConfig.scale += .5;
    //   if (this.zoomConfig.scale > 2) {
    //     this.zoomConfig.scale = 1;
    //     reset = true;
    //   }

    //   this.setBounds();
    //   reset ? this.transform(this.zoomConfig.max_x/2, this.zoomConfig.max_y/2) : this.transform();
    // }
  }

  onDoubleTap(ev) {
    this.zoomConfig.last_x = 0;
    this.zoomConfig.last_y = 0;
    this.setCoor(0, 0);
    this.zoomConfig.scale = 1;
    this.zoomConfig.last_scale = 1;
    this.zoomConfig.center = { x: null, y: null };
    this.setBounds();
    this.transform();
  }
  onPinch(ev) {
    let z = this.zoomConfig;
    // let last_scale = z.scale;
    z.scale = Math.max(z.min_scale, Math.min(z.last_scale * ev.scale, z.max_scale));
    // if (Math.abs(last_scale - z.scale) > z.scale_threshold) {
      var xx = (z.scale - z.last_scale) * (z.original_x / 2 - ev.center.x);
      var yy = (z.scale - z.last_scale) * (z.original_y / 2 - ev.center.y);
      this.setCoor(xx, yy);
    // } else {
    //   this.setCoor(ev.deltaX, ev.deltaY);
    // }
    this.setBounds();
    this.transform();
  }

  onPinchend(ev) {
    let z = this.zoomConfig;
    z.last_scale = z.scale;
    z.last_x = z.x;
    z.last_y = z.y;
    z.center = { x: null, y: null };
  }

  setBounds() {
    // optimise scale 1 instance    
    if (this.zoomConfig.scale == 1) {
      this.zoomConfig.x = 0;
      if (this.zoomConfig.y >= 0) {
        this.zoomConfig.y = 0;
      } else {
        this.zoomConfig.max_y = this.zoom.nativeElement.scrollHeight - this.zoom.nativeElement.clientHeight + 112;
        if (this.zoomConfig.y < -this.zoomConfig.max_y) {
          this.zoomConfig.y = -this.zoomConfig.max_y;
        }
      }
    } else {
      this.zoomConfig.max_x = Math.ceil(this.zoom.nativeElement.clientWidth * (this.zoomConfig.scale - 1) / 2);
      if (this.zoomConfig.x < -this.zoomConfig.max_x) {
        this.zoomConfig.x = -this.zoomConfig.max_x;
      } else if (this.zoomConfig.x > this.zoomConfig.max_x) {
        this.zoomConfig.x = this.zoomConfig.max_x;
      }
      this.zoomConfig.max_y = Math.ceil(this.zoomConfig.scale * this.zoom.nativeElement.scrollHeight - this.zoom.nativeElement.clientHeight * (this.zoomConfig.scale + 1) / 2) + 112;
      var y_top_offset = Math.ceil(this.zoom.nativeElement.clientHeight * (this.zoomConfig.scale - 1) / 2);
      if (this.zoomConfig.y < -this.zoomConfig.max_y) {
        this.zoomConfig.y = -this.zoomConfig.max_y;
      } else if (this.zoomConfig.y > y_top_offset) {
        this.zoomConfig.y = y_top_offset
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
