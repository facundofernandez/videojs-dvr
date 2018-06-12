import videojs from 'video.js';
import {version as VERSION} from '../package.json';

// Default options for the plugin.
const defaults = {
  startTime: 0
};

// Cross-compatibility for Video.js 5 and 6.
const registerPlugin = videojs.registerPlugin || videojs.plugin;
//const dom = videojs.dom || videojs;

const PlayProgressBar = videojs.getComponent('PlayProgressBar');
const MouseTimeDisplay = videojs.getComponent('MouseTimeDisplay');
const LoadProgressBar = videojs.getComponent('LoadProgressBar');
const Slider = videojs.getComponent('Slider');

Slider.prototype.update = function update() {

  //if (typeof this.player_.tech_.hls.playlists.media_ !== "undefined") this.player_.tech_.hls.playlists.media_["endList"] = true;

  // In VolumeBar init we have a setTimeout for update that pops and update
  // to the end of the execution stack. The player is destroyed before then
  // update will cause an error
  if (!this.el_) {
    return;
  }

  // If scrubbing, we could use a cached value to make the handle keep up
  // with the user's mouse. On HTML5 browsers scrubbing is really smooth, but
  // some flash players are slow, so we might want to utilize this later.

  //let durationCustom = this.player_.duration() === Number.POSITIVE_INFINITY ? 100000 : this.player_.duration();

  //let progress =  (this.player_.scrubbing()) ? this.player_.getCache().currentTime / durationCustom : this.player_.currentTime() / durationCustom;
  //let progress = (this.player_.scrubbing()) ? this.player_.getCache().currentTime / this.player_.duration() : this.player_.currentTime() / this.player_.duration();
  //let progress =  (this.player_.scrubbing()) ? this.player_.getCache().currentTime / this.player_.getCache().duration() : this.player_.currentTime() / this.player_.duration();
  let progress = this.getPercent();
  const bar = this.bar;

  // If there's no bar...
  if (!bar) {
    return;
  }
  /*
  console.log("slider", progress, {
    scrubbing: this.player_.scrubbing(),
    cache: this.player_.getCache(),
    duration: this.player_.duration(),
    durationCache: this.player_.getCache().duration,
    //durationCustom: durationCustom,
    currentTime: this.player_.currentTime()
  });

  */
  // Protect against no duration and other division issues
  if (typeof progress !== 'number' ||
    progress !== progress ||
    progress < 0 ||
    progress === Infinity) {
    progress = 0;
  }


  //if(progress === 0) progress = 1;

  // Convert to a percentage for setting
  const percentage = (progress * 100).toFixed(2) + '%';
  const style = bar.el().style;

  // Set the new bar width or height
  if (progress !== 0) {
    if (this.vertical()) {
      style.height = percentage;
    } else {
      style.width = percentage;
    }
  }

  //console.log(progress);

  return progress;
};


PlayProgressBar.prototype.update = function update(seekBarRect, seekBarPoint) {

  // If there is an existing rAF ID, cancel it so we don't over-queue.
  if (this.rafId_) {
    this.cancelAnimationFrame(this.rafId_);
  }

  this.rafId_ = this.requestAnimationFrame(() => {
    const time = (this.player_.scrubbing()) ?
      this.player_.getCache().currentTime :
      this.player_.currentTime();

    const content = videojs.formatTime(this.player_.duration() - time, this.player_.duration());

    if(seekBarPoint !== 0 && this.player_.duration() !== Number.POSITIVE_INFINITY) {

     /*
      console.log(
        "duration",this.player_.duration(),
        "seekBarRect", seekBarRect,
        "seekBarPoint", seekBarPoint,
        "content", content);
      */

      this.getChild('timeTooltip').update(seekBarRect, seekBarPoint, `-${content}`);
    }
  });
};
MouseTimeDisplay.prototype.update = function update(seekBarRect, seekBarPoint) {

  // If there is an existing rAF ID, cancel it so we don't over-queue.
  if (this.rafId_) {
    this.cancelAnimationFrame(this.rafId_);
  }

  this.rafId_ = this.requestAnimationFrame(() => {
    const duration = this.player_.duration();
    //const content = videojs.formatTime(seekBarPoint * duration, duration);
    const content2 = videojs.formatTime(duration - (seekBarPoint * duration), duration);
    //console.log(seekBarRect, seekBarPoint,duration,content,content2);


    this.el_.style.left = `${seekBarRect.width * seekBarPoint}px`;

    if(seekBarPoint !== 0 && this.player_.duration() !== Number.POSITIVE_INFINITY) {
      this.getChild('timeTooltip').update(seekBarRect, seekBarPoint, `-${content2}`);
    }

  });
}

/**
 * Function to invoke when the player is ready.
 *
 * This is a great place for your plugin to initialize itself. When this
 * function is called, the player will have its DOM and child components
 * in place.
 *
 * @function onPlayerReady
 * @param    {Player} player
 *           A Video.js player object.
 *
 * @param    {Object} [options={}]
 *           A plain object containing options for the plugin.
 */
const onPlayerReady = (player, options) => {

  player.addClass('vjs-dvr');

  player.controlBar.addClass('vjs-dvr-control-bar');

  if (player.controlBar.progressControl) {
    player.controlBar.progressControl.addClass('vjs-dvr-progress-control');
  }

  // ADD Live Button:
  let btnLiveEl = document.createElement('div');
  let newLink = document.createElement('a');

  btnLiveEl.className = 'vjs-live-button vjs-control';

  newLink.innerHTML = document.getElementsByClassName('vjs-live-display')[0].innerHTML;
  newLink.id = 'liveButton';
  newLink.className ='vjs-live-label';

  if (!player.paused()) {
    newLink.className = 'vjs-live-label onair';
  }

  let clickHandler = function (e) {
    let currentTime = player.seekable().end(0);
    player.currentTime(currentTime);
    player.play();
  };

  if (newLink.addEventListener) {
    // DOM method
    newLink.addEventListener('click', clickHandler, false);
  } else if (newLink.attachEvent) {
    // this is for IE, because it doesn't support addEventListener
    newLink.attachEvent('onclick', function () {
      return clickHandler.apply(newLink, [window.event]);
    });
  }

  btnLiveEl.appendChild(newLink);

  let controlBar = document.getElementsByClassName('vjs-control-bar')[0];
  let insertBeforeNode = document.getElementsByClassName('vjs-progress-control')[0];

  controlBar.insertBefore(btnLiveEl, insertBeforeNode);

  //videojs.log('dvr Plugin ENABLED!', options);

};


const onTimeUpdate = (player, e) => {

  let time = player.seekable();
  let btnLiveEl = document.getElementById('liveButton');

  // When any tech is disposed videojs will trigger a 'timeupdate' event
  // when calling stopTrackingCurrentTime(). If the tech does not have
  // a seekable() method, time will be undefined
  if (!time || !time.length) {
    return;
  }


  if (time.end(0) - player.currentTime() < 30) {
    btnLiveEl.className = 'vjs-live-label onair';
  } else {
    btnLiveEl.className = 'vjs-live-label';
  }
  player.duration(player.seekable().end(0));
};


/**
 * A video.js plugin.
 *
 * In the plugin function, the value of `this` is a video.js `Player`
 * instance. You cannot rely on the player being in a "ready" state here,
 * depending on how the plugin is invoked. This may or may not be important
 * to you; if not, remove the wait for "ready"!
 *
 * @function dvr
 * @param    {Object} [options={}]
 *           An object of options left to the plugin author to define.
 */
const dvr = function (options) {

  if (!options) {
    options = defaults;
  }

  this.on('timeupdate', (e) => {
    onTimeUpdate(this, e);
  });

  this.on('pause', (e) => {
    let btnLiveEl = document.getElementById('liveButton');

    btnLiveEl.className = 'vjs-live-label';
  });

  this.ready(() => {
    onPlayerReady(this, videojs.mergeOptions(defaults, options));
  });
};

// Register the plugin with video.js.
registerPlugin('dvr', dvr);

// Include the version number.
dvr.VERSION = VERSION;

export default dvr;
