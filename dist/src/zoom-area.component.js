import { Component, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Gesture, Content } from 'ionic-angular';
import { ZoomAreaProvider } from './zoom-area.provider';
var ZoomAreaComponent = /** @class */ (function () {
    function ZoomAreaComponent(zoomAreaProvider) {
        this.zoomAreaProvider = zoomAreaProvider;
        this.afterZoomIn = new EventEmitter();
        this.afterZoomOut = new EventEmitter();
        this.controlsChanged = new EventEmitter();
        this.scaleChanged = new EventEmitter();
        this.zoomConfig = {
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
            min_scale: 1
        };
        this.zoomControlsState = 'hidden';
    }
    ZoomAreaComponent.prototype.ngOnChanges = function (changes) {
        if ('controls' in changes) {
            var showControls = changes['controls'];
            if (showControls && showControls.currentValue) {
                this.zoomControlsState = 'shown';
            }
            else {
                this.zoomControlsState = 'hidden';
            }
        }
        if ('scale' in changes) {
            var scaleValue = changes['scale'];
            if (scaleValue && scaleValue.currentValue && scaleValue.currentValue === 1) {
                this.zoomReset();
            }
        }
    };
    ZoomAreaComponent.prototype.ngAfterViewInit = function () {
        var _this = this;
        this.content.ionScroll.subscribe(function (data) {
            _this.zoomAreaProvider.notifyScroll(data);
        });
        this._pinchZoom(this.zoom.nativeElement, this.content);
        // Watch for user setCenter call
        var self = this;
        this.zoomAreaProvider.centerChanged$.subscribe(function (coords) {
            if (self.zoomConfig.scale === 1) {
                return;
            }
            self.setCoor(coords.x, coords.y);
            self.transform(coords.x, coords.y);
        });
    };
    ZoomAreaComponent.prototype.toggleZoomControls = function () {
        // this.zoomControlsState = this.zoomControlsState === 'shown' ? 'hidden' : 'shown';
        this.zoomControlsState = 'hidden';
    };
    ZoomAreaComponent.prototype.zoomIn = function () {
        this.zoomConfig.scale += 1;
        if (this.zoomConfig.scale > 1) {
            this.zoomAreaProvider.notifyScrollState(this.zoomAreaProvider.SCROLL_STATE.COLAPSED);
        }
        if (this.zoomConfig.scale > this.zoomConfig.max_scale) {
            this.zoomConfig.scale = this.zoomConfig.max_scale;
        }
        this.transform();
        this.afterZoomIn.emit();
    };
    ZoomAreaComponent.prototype.zoomOut = function (reset) {
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
    };
    ZoomAreaComponent.prototype.zoomReset = function () {
        this.zoomConfig.scale = this.zoomConfig.min_scale;
        if (this.content && this.content.scrollTop) {
            this.content.scrollTop = 0;
        }
        this.zoomOut(true);
    };
    ZoomAreaComponent.prototype._pinchZoom = function (elm, content) {
        this.gesture = new Gesture(elm);
        this.zoomConfig.original_x = this.zoom.nativeElement.clientWidth;
        this.zoomConfig.original_y = this.zoom.nativeElement.clientHeight;
        this.zoomConfig.max_x = this.zoomConfig.original_x;
        this.zoomConfig.max_y = this.zoomConfig.original_y;
        this.zoomConfig.last_scale = this.zoomConfig.scale;
        this.gesture.listen();
        this.gesture.on('pan', this.onPan.bind(this));
        this.gesture.on('panend', this.onPanend.bind(this));
        this.gesture.on('pancancel', this.onPanend.bind(this));
        // this.gesture.on('tap', this.onTap.bind(this));
        this.gesture.on('pinch', this.onPinch.bind(this));
        this.gesture.on('pinchend', this.onPinchend.bind(this));
        this.gesture.on('pinchcancel', this.onPinchend.bind(this));
    };
    ZoomAreaComponent.prototype.onPan = function (ev) {
        if (this.zoomConfig.scale === 1) {
            return;
        }
        this.setCoor(ev.deltaX, ev.deltaY);
        this.setBounds();
        this.transform();
    };
    ZoomAreaComponent.prototype.onPanend = function () {
        this.zoomConfig.last_x = this.zoomConfig.x < this.zoomConfig.max_x ? this.zoomConfig.x : this.zoomConfig.max_x;
        this.zoomConfig.last_y = this.zoomConfig.y < this.zoomConfig.max_y ? this.zoomConfig.y : this.zoomConfig.max_y;
        this.zoomConfig.center = { x: null, y: null };
    };
    ZoomAreaComponent.prototype.onTap = function (ev) {
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
    };
    ZoomAreaComponent.prototype.onDoubleTap = function (ev) {
        this.zoomConfig.last_x = 0;
        this.zoomConfig.last_y = 0;
        this.setCoor(0, 0);
        this.zoomConfig.scale = 1;
        this.zoomConfig.last_scale = 1;
        this.zoomConfig.center = { x: null, y: null };
        this.setBounds();
        this.transform();
    };
    ZoomAreaComponent.prototype.onPinch = function (ev) {
        var z = this.zoomConfig;
        z.scale = Math.max(z.min_scale, Math.min(z.last_scale * ev.scale, z.max_scale));
        var xx = (z.scale - z.last_scale) * (z.original_x / 2 - ev.center.x);
        var yy = (z.scale - z.last_scale) * (z.original_y / 2 - ev.center.y);
        this.setCoor(xx, yy);
        this.setBounds();
        this.transform();
    };
    ZoomAreaComponent.prototype.onPinchend = function (ev) {
        var z = this.zoomConfig;
        z.last_scale = z.scale;
        z.last_x = z.x;
        z.last_y = z.y;
        z.center = { x: null, y: null };
    };
    ZoomAreaComponent.prototype.setBounds = function () {
        this.zoomConfig.max_x = Math.ceil((this.zoomConfig.scale - 1) * this.zoom.nativeElement.clientWidth / 2);
        this.zoomConfig.max_y = Math.ceil((this.zoomConfig.scale - 1) * this.zoom.nativeElement.clientHeight / 2);
        if (this.zoomConfig.x > this.zoomConfig.max_x) {
            this.zoomConfig.x = this.zoomConfig.max_x;
        }
        if (this.zoomConfig.x < -this.zoomConfig.max_x) {
            this.zoomConfig.x = -this.zoomConfig.max_x;
        }
        if (this.zoomConfig.y > this.zoomConfig.max_y) {
            this.zoomConfig.y = this.zoomConfig.max_y;
        }
        if (this.zoomConfig.y < -this.zoomConfig.max_y) {
            this.zoomConfig.y = -this.zoomConfig.max_y;
        }
    };
    ZoomAreaComponent.prototype.setCoor = function (xx, yy) {
        this.zoomConfig.x = this.zoomConfig.last_x + xx;
        this.zoomConfig.y = this.zoomConfig.last_y + yy;
    };
    ZoomAreaComponent.prototype.transform = function (xx, yy) {
        this.zoomRootElement.style.transform = "translate3d(" + (xx || this.zoomConfig.x) + "px, " + (yy || this.zoomConfig.y) + "px, 0) scale3d(" + this.zoomConfig.scale + ", " + this.zoomConfig.scale + ", 1)";
    };
    ZoomAreaComponent.decorators = [
        { type: Component, args: [{
                    selector: 'zoom-area',
                    template: "\n    <ion-content>\n      <div #zoomAreaRoot class=\"zoom\" (click)=\"toggleZoomControls()\">\n        <div class=\"fit\">\n          <ng-content></ng-content>\n        </div>\n      </div>\n\n      <ion-fab right top [@visibilityChanged]=\"zoomControlsState\">\n        <button (click)=\"zoomIn()\" ion-fab color=\"primary\" class=\"btn-zoom\">\n            <ion-icon name=\"add-circle\"></ion-icon>\n        </button>\n\n        <button (click)=\"zoomOut()\" ion-fab color=\"primary\" class=\"btn-zoom\">\n            <ion-icon name=\"remove-circle\"></ion-icon>\n        </button>\n\n        <button (click)=\"zoomReset()\" ion-fab color=\"primary\" class=\"btn-zoom\">\n            <ion-icon name=\"md-contract\"></ion-icon>\n        </button>\n      </ion-fab>\n    </ion-content>\n",
                    animations: [
                        trigger('visibilityChanged', [
                            state('shown', style({ opacity: 1, display: 'block' })),
                            state('hidden', style({ opacity: 0, display: 'none' })),
                            transition('shown => hidden', animate('300ms')),
                            transition('hidden => shown', animate('300ms')),
                        ])
                    ]
                },] },
    ];
    /** @nocollapse */
    ZoomAreaComponent.ctorParameters = function () { return [
        { type: ZoomAreaProvider, },
    ]; };
    ZoomAreaComponent.propDecorators = {
        "zoom": [{ type: ViewChild, args: ['zoomAreaRoot',] },],
        "content": [{ type: ViewChild, args: [Content,] },],
        "afterZoomIn": [{ type: Output },],
        "afterZoomOut": [{ type: Output },],
        "controls": [{ type: Input },],
        "controlsChanged": [{ type: Output },],
        "scale": [{ type: Input },],
        "scaleChanged": [{ type: Output },],
    };
    return ZoomAreaComponent;
}());
export { ZoomAreaComponent };
//# sourceMappingURL=zoom-area.component.js.map