import videojs from 'video.js';
import {Dom} from 'video.js'
import {version as VERSION} from '../package.json';

// Default options for the plugin.
const defaults = {
  startTime: 0,
  timeLive: 60 * 60
};

let timeLive = 0;

let customTime = defaults.timeLive;

// Cross-compatibility for Video.js 5 and 6.
const registerPlugin = videojs.registerPlugin || videojs.plugin;
//const dom = videojs.dom || videojs;

/**/

const ProgressControl = videojs.getComponent('ProgressControl');
const SeekBar = ProgressControl.getComponent('SeekBar');
const PlayProgressBar = ProgressControl.getComponent('PlayProgressBar');
const MouseTimeDisplay = videojs.getComponent('MouseTimeDisplay');//SeekBar.mouseTimeDisplay;

const LoadProgressBar = ProgressControl.getComponent('LoadProgressBar');

LoadProgressBar.prototype.update = function (event) {

  const buffered = this.player_.buffered();
  const duration = this.player_.duration();
  const bufferedEnd = this.player_.bufferedEnd();
  const children = this.partEls_;

  // get the percent width of a time compared to the total end
  const percentify = function (time, end) {
    // no NaN
    const percent = (time / end) || 0;

    return ((percent >= 1 ? 1 : percent) * 100) + '%';
  };


  // update the width of the progress bar
  if (percentify(bufferedEnd, duration) !== 0)
    this.el_.style.width = percentify(bufferedEnd, duration);
  //this.el_.style.width = percentify(bufferedEnd-bufferedEnd-20, duration);

  // add child elements to represent the individual buffered time ranges
  for (let i = 0; i < buffered.length; i++) {
    const start = buffered.start(i);
    //const start = buffered.end(i) - customTime;//buffered.start(i);
    const end = buffered.end(i);
    let part = children[i];

    if (!part) {
      part = this.el_.appendChild(document.createElement("div"));
      children[i] = part;
    }

    if (percentify(start, bufferedEnd) !== 0) {
      // set the percent based on the width of the progress bar (bufferedEnd)
      part.style.left = percentify(start, bufferedEnd);
    }

    if (percentify(end - start, bufferedEnd) !== 0) {
      part.style.width = percentify(end - start, bufferedEnd);

    }
  }

  // remove unused buffered range elements
  for (let i = children.length; i > buffered.length; i--) {
    this.el_.removeChild(children[i - 1]);
  }

  children.length = buffered.length;
};

SeekBar.prototype.update_ = function (currentTime, percent) {

  const duration = this.player_.duration();
  const time = (this.player_.scrubbing()) ?
    this.player_.getCache().currentTime : this.player_.currentTime();

  // machine readable value of progress bar (percentage complete)
  this.el_.setAttribute('aria-valuenow', (percent * 100).toFixed(2));

  // human readable value of progress bar (time complete)
  /*
  this.el_.setAttribute('aria-valuetext',
    this.localize('progress bar timing: currentTime={1} duration={2}',
      [formatTime(currentTime, duration),
        formatTime(duration, duration)],
      '{1} of {2}'));
   */
  //console.log(duration - time, duration);
  if (duration !== Number.POSITIVE_INFINITY) {
    this.el_.setAttribute('aria-valuetext', `-${videojs.formatTime(duration - time, duration)}`);
  }
  // Update the `PlayProgressBar`.
  this.bar.update(videojs.dom.getBoundingClientRect(this.el_), percent);

};

SeekBar.prototype.handleMouseMove = function (event) {

  let calculate = 1 - this.calculateDistance(event);
  //let newTime = this.calculateDistance(event) * this.player_.duration();
  let newTime = this.calculateDistance(event) * this.player_.seekable().end(0);
  let newTime2 = this.player_.seekable().end(0) - (calculate * customTime);

  // Don't let video end while scrubbing.
  if (newTime === this.player_.duration()) newTime = newTime - 0.1;
  if (newTime2 === this.player_.duration()) newTime2 = newTime2 - 0.1;


  // Set new time (tell player to seek to new time)
  //this.player_.currentTime(newTime);
  this.player_.currentTime(newTime2);


};

PlayProgressBar.prototype.update = function update(seekBarRect, seekBarPoint) {

  let duration = this.player_.duration();

  // If there is an existing rAF ID, cancel it so we don't over-queue.
  if (this.rafId_) this.cancelAnimationFrame(this.rafId_);

  this.rafId_ = this.requestAnimationFrame(() => {

    const time = (this.player_.scrubbing()) ?
      this.player_.getCache().currentTime : this.player_.currentTime();

    //const content = videojs.formatTime(this.player_.duration() - time, this.player_.duration());
    //console.log(videojs.formatTime(this.player_.duration() - time, this.player_.duration()));
    const content = videojs.formatTime(duration - time, duration);
    //const content = videojs.formatTime(duration - time, customDuration);

    if (seekBarPoint !== 0 && duration !== Number.POSITIVE_INFINITY) {
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
    const content2 = videojs.formatTime(customTime - (seekBarPoint * customTime), customTime);
    //const content2 = videojs.formatTime(customDuration - (seekBarPoint * customDuration), customDuration);

    this.el_.style.left = `${seekBarRect.width * seekBarPoint}px`;

    if (seekBarPoint !== 0 && this.player_.duration() !== Number.POSITIVE_INFINITY) {
      this.getChild('timeTooltip').update(seekBarRect, seekBarPoint, `-${content2}`);
    }

  });
};

/**/


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

  const Slider = player.controlBar.progressControl.seekBar.__proto__;//ProgressControl.getComponent('Slider');

  Slider.__proto__.update = function update() {

    if (!this.el_) {
      return;
    }

    let progress;

    progress = this.name_ === "VolumeBar" ?  this.getPercent() : (1 - (this.player_.duration() - this.player_.currentTime()) / customTime);

    const bar = this.bar;

    if (!bar) return;

    // Protect against no duration and other division issues
    if (typeof progress !== 'number' ||
      progress !== progress ||
      progress < 0 ||
      progress === Infinity) {
      progress = 0;
    }

    if (progress > 1) progress = 1;

    // Convert to a percentage for setting
    const percentage = (progress * 100).toFixed(2) + '%';
    const style = bar.el().style;
    //console.log(this.getPercent())
    // Set the new bar width or height
    if (progress !== 0) {
      if (this.vertical()) {
        style.height = percentage;
      } else {
        style.width = percentage;
      }
    }

    return progress;

  };

  if (player.controlBar.progressControl) {
    player.controlBar.progressControl.addClass('vjs-dvr-progress-control');
  }

  // ADD Live Button:
  let btnLiveEl = document.createElement('div');
  let newLink = document.createElement('a');

  btnLiveEl.className = 'vjs-live-button vjs-control';

  newLink.innerHTML = `<span class="liveCircle"></span><span class="liveText">LIVE</span>`;//document.getElementsByClassName('vjs-live-display')[0].innerHTML;
  newLink.id = 'liveButton';
  newLink.className = !player.paused() ? dvr.ClassOnAir : dvr.ClassOutAir;

  let clickHandler = function (e) {
    let currentTime = player.seekable().end(0);
    //let src = player.src();
    //player.src(src);
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
  if (!time || !time.length) return;

  //btnLiveEl.className = (time.end(0) - player.currentTime()) < defaults.timeLive ? dvr.ClassOnAir : dvr.ClassOutAir;
  btnLiveEl.className = (time.end(0) - player.currentTime()) < 20 ? dvr.ClassOnAir : dvr.ClassOutAir;

  player.duration(player.seekable().end(0));

  if (!timeLive) timeLive = customTime = player.seekable().end(0);

  //player.duration(20);
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

dvr.ClassOnAir = "vjs-live-label onair";
dvr.ClassOutAir = "vjs-live-label";

export default dvr;
