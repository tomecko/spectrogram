const heading = document.querySelector("h1");
heading.textContent = "CLICK HERE TO START";
document.body.addEventListener("click", init);

const COLOR_SCALE = [
  "#000083",
  "#001e97",
  "#003caa",
  "#0163bb",
  "#028acc",
  "#03b1dd",
  "#04d8ee",
  "#05ffff",
  "#37ffcc",
  "#69ff99",
  "#9bff66",
  "#cdff33",
  "#ffff00",
  "#fecc00",
  "#fd9900",
  "#fc6600",
  "#fb3300",
  "#fa0000",
  "#bd0000",
  "#800000",
];

function init() {
  heading.textContent = "Spectrogram";
  document.body.removeEventListener("click", init);

  // Older browsers might not implement mediaDevices at all, so we set an empty object first
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }

  // Some browsers partially implement mediaDevices. We can't assign an object
  // with getUserMedia as it would overwrite existing properties.
  // Add the getUserMedia property if it's missing.
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      // First get ahold of the legacy getUserMedia, if present
      const getUserMedia =
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        return Promise.reject(
          new Error("getUserMedia is not implemented in this browser")
        );
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }

  // Set up forked web audio context, for multiple browsers
  // window. is needed otherwise Safari explodes
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Set up the different audio nodes we will use for the app
  const analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = 0.85;

  // Set up canvas context for visualizer
  const canvasTimeline = document.getElementById("timeline");
  const canvasTimelineCtx = canvasTimeline.getContext("2d");
  const canvasCurrent = document.getElementById("current");
  const canvasCurrentCtx = canvasCurrent.getContext("2d");

  const intendedWidth = document.querySelector(".wrapper").clientWidth;
  canvasTimeline.setAttribute("width", intendedWidth);
  canvasCurrent.setAttribute("width", intendedWidth);

  // Main block for doing the audio recording
  if (navigator.mediaDevices.getUserMedia) {
    console.log("getUserMedia supported.");
    const constraints = { audio: true };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(function (stream) {
        console.log(stream);
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        visualize();
      })
      .catch(function (err) {
        console.log("The following gUM error occured: " + err);
      });
  } else {
    console.log("getUserMedia not supported on your browser!");
  }

  function visualize() {
    const DRAW_N_DATA_POINTS = 1000;

    console.log("visualize!!");

    analyser.fftSize = 4096;
    const bufferLength = analyser.frequencyBinCount / 80;

    // See comment above for Float32Array()
    const dataArray = new Uint8Array(bufferLength);

    let dataAcc = [];

    const analyse = function (data) {
      const HIGH_ENOUGH = 200;
      const maxOrHighEnough = Math.max(
        HIGH_ENOUGH,
        data.reduce((acc, curr) => Math.max(acc, curr), 0)
      );
      console.log(maxOrHighEnough);
      return data.map((val) => (val / maxOrHighEnough) * 100);
    };

    const drawTimeline = function (canvas, canvasCtx, data) {
      const SHOW_LAST_N_SECONDS = 5;
      const BACKGROUND_COLOR = "#000";
      WIDTH = canvas.width;
      HEIGHT = canvas.height;
      const CELL_WIDTH = 3;
      const CELL_HEIGHT = HEIGHT / bufferLength;
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.fillStyle = BACKGROUND_COLOR;
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      data.forEach((pointData) => {
        const x = WIDTH - Math.round(
          ((Date.now() - pointData.ts) / 1000 / SHOW_LAST_N_SECONDS) * WIDTH
        );
        pointData.data
          .slice()
          .reverse()
          .forEach((val, i) => {
            const MIN_THRESHOLD = 20;
            canvasCtx.fillStyle =
              val > MIN_THRESHOLD
                ? COLOR_SCALE[Math.round((val / 100) * COLOR_SCALE.length)]
                : BACKGROUND_COLOR;
            canvasCtx.fillRect(x, i * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT);
          });
      });
    };

    const drawCurrent = function (canvas, canvasCtx) {
      WIDTH = canvas.width;
      HEIGHT = canvas.height;
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.fillStyle = "rgb(0, 0, 0)";
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
      const barWidth = (WIDTH / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];

        canvasCtx.fillStyle = "rgb(" + (barHeight + 100) + ",50,50)";
        canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight / 2);

        x += barWidth + 1;
      }
    };

    const tick = function () {
      requestAnimationFrame(tick);

      analyser.getByteFrequencyData(dataArray);
      dataAcc = [
        ...dataAcc,
        { data: analyse(dataArray), ts: Date.now() },
      ].slice(-DRAW_N_DATA_POINTS);

      drawTimeline(canvasTimeline, canvasTimelineCtx, dataAcc);
      drawCurrent(canvasCurrent, canvasCurrentCtx);
    };

    tick();
  }
}
