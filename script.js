const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const recognizedEl = document.getElementById('recognized');

let model;

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  });
  video.srcObject = stream;
  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

function isStopObject(className) {
  return ['person', 'cat', 'dog'].includes(className);
}

// 신호등 색상 분석 (bbox 영역을 캔버스에서 잘라내서 평균 색상 확인)
function analyzeTrafficLightColor(imageData) {
  let rSum = 0, gSum = 0, bSum = 0;
  const pixelCount = imageData.data.length / 4;

  for (let i = 0; i < imageData.data.length; i += 4) {
    rSum += imageData.data[i];
    gSum += imageData.data[i + 1];
    bSum += imageData.data[i + 2];
  }

  const rAvg = rSum / pixelCount;
  const gAvg = gSum / pixelCount;
  const bAvg = bSum / pixelCount;

  // 빨간색 성분이 가장 크면 빨강불, 초록색 성분이 크면 초록불, 그 다음 노란(빨+초록 조합) 추정
  if (rAvg > 150 && gAvg < 100) {
    return 'red';
  }
  if (gAvg > 150 && rAvg < 100) {
    return 'green';
  }
  if (rAvg > 150 && gAvg > 150) {
    return 'yellow';
  }
  return 'unknown';
}

function drawBoundingBox(prediction) {
  const [x, y, width, height] = prediction.bbox;

  ctx.strokeStyle = '#f0a500';
  ctx.lineWidth = 3;
  ctx.font = '18px Arial';
  ctx.fillStyle = '#f0a500';

  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.stroke();

  ctx.fillText(prediction.class, x + 5, y > 20 ? y - 8 : y + 20);
}

async function detectFrame() {
  const predictions = await model.detect(video);

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  let stopFlag = false;
  let slowFlag = false;
  let recognizedClasses = [];

  for (let prediction of predictions) {
    drawBoundingBox(prediction);
    recognizedClasses.push(prediction.class);

    if (isStopObject(prediction.class)) {
      stopFlag = true;
    }

    if (prediction.class === 'traffic light') {
      // bbox 영역만 잘라서 색상 분석
      let [x, y, width, height] = prediction.bbox;

      // 경계 체크
      x = Math.max(0, x);
      y = Math.max(0, y);
      width = Math.min(canvas.width - x, width);
      height = Math.min(canvas.height - y, height);

      const imageData = ctx.getImageData(x, y, width, height);
      const color = analyzeTrafficLightColor(imageData);

      if (color === 'red' || color === 'yellow') {
        stopFlag = true;
      } else if (color === 'green') {
        slowFlag = true;
      }
    }
  }

  if (stopFlag) {
    statusEl.textContent = '정지';
    statusEl.className = 'status';
  } else if (slowFlag) {
    statusEl.textContent = '서행';
    statusEl.className = 'status slow';
  } else {
    statusEl.textContent = '안전';
    statusEl.className = 'status go';
  }

  recognizedEl.textContent = '인식된 객체: ' + (recognizedClasses.length ? recognizedClasses.join(', ') : '없음');

  requestAnimationFrame(detectFrame);
}

async function main() {
  await setupCamera();
  video.play();
  model = await cocoSsd.load();
  detectFrame();
}

main();
