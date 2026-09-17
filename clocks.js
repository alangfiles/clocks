function getDaylightHours(input_date, latitude = 40.4173){
  const date = new Date(input_date);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - yearStart) / 86400000 + 1;
  const declination = -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365.2425);
  const latitudeRadians = latitude * Math.PI / 180;
  const declinationRadians = declination * Math.PI / 180;
  const hourAngleCosine = -Math.tan(latitudeRadians) * Math.tan(declinationRadians);
  const hourAngle = Math.acos(Math.max(-1, Math.min(1, hourAngleCosine)));

  return 24 * hourAngle / Math.PI;
}

function getSolarTimes(input_date, latitude = 40.4173, longitude = -82.9071){
  const date = new Date(input_date);
  const daylightHours = getDaylightHours(date, latitude);
  const noon = 12 - longitude / 15 - date.getTimezoneOffset() / 60;

  return {
    noon,
    sunrise: noon - daylightHours / 2,
    sunset: noon + daylightHours / 2
  };
}

function formatClockTime(hours){
  const totalMinutes = Math.round((((hours % 24) + 24) % 24) * 60);
  const hour = Math.floor((totalMinutes % 1440) / 60);
  const minute = totalMinutes % 60;
  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? "AM" : "PM";

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function formatMilliseconds(milliseconds){
  return `${milliseconds.toFixed(0)} imperial milliseconds`;
}

// Parses "6:30 AM", "18:30", or "6 PM" into a fractional hour (0-24), or null if unparseable
function parseTimeInput(text){
  const match = String(text).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!match) {
    return null;
  }

  const [, hourText, minuteText, periodText] = match;
  let hour = parseInt(hourText, 10);
  const minute = minuteText ? parseInt(minuteText, 10) : 0;
  if (minute > 59) {
    return null;
  }

  if (periodText) {
    if (hour < 1 || hour > 12) {
      return null;
    }
    const isPM = periodText.toLowerCase() === "pm";
    hour = (hour % 12) + (isPM ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }

  return hour + minute / 60;
}

// Converts a Well-Tempered Time hour (0-24) to the corresponding imperial hour, given today's sunrise and daylight length
function wttHourToImperialHour(wttHour, sunrise, daylightHours){
  const isDaylight = wttHour >= 6 && wttHour < 18;
  const segmentPosition = isDaylight ? wttHour - 6 : (wttHour >= 18 ? wttHour - 18 : wttHour + 6);
  const segmentLength = isDaylight ? daylightHours / 12 : (24 - daylightHours) / 12;
  const lightHours = isDaylight ? segmentPosition * segmentLength : daylightHours + segmentPosition * segmentLength;

  return ((lightHours + sunrise) % 24 + 24) % 24;
}

// Converts an imperial hour (0-24) to the corresponding Well-Tempered Time hour, given today's sunrise and daylight length
function imperialHourToWttHour(imperialHour, sunrise, daylightHours){
  const lightHours = ((imperialHour - sunrise) + 24) % 24;
  const isDaylight = lightHours < daylightHours;
  const segmentLength = isDaylight ? daylightHours / 12 : (24 - daylightHours) / 12;
  const segmentPosition = isDaylight ? lightHours / segmentLength : (lightHours - daylightHours) / segmentLength;

  return (segmentPosition + (isDaylight ? 6 : 18)) % 24;
}

function getMatchingTimes(input_date, latitude = 40.4173, longitude = -82.9071){
  const date = new Date(input_date);
  const solarTimes = getSolarTimes(date, latitude, longitude);
  const daylightHours = solarTimes.sunset - solarTimes.sunrise;
  const nightHours = 24 - daylightHours;
  const segments = [
    { start: solarTimes.sunrise, duration: daylightHours, alanStart: 6 },
    { start: solarTimes.sunset, duration: nightHours, alanStart: 18 }
  ];
  const matches = [];

  for (const segment of segments) {
    const alanRate = 12 / segment.duration;
    for (let offset = -2; offset <= 2; offset += 1) {
      const time = (12 * offset - segment.alanStart + alanRate * segment.start) / (alanRate - 1);
      if (time >= segment.start && time < segment.start + segment.duration) {
        matches.push(Math.round(time * 60) / 60);
      }
    }
  }

  return [...new Set(matches)].sort((first, second) => first - second);
}

function getAlanTimeParts(input_date, latitude = 40.4173, longitude = -82.9071){
  const date = new Date(input_date);
  const solarTimes = getSolarTimes(date, latitude, longitude);
  const daylightHours = solarTimes.sunset - solarTimes.sunrise;

  // High-precision local hours including milliseconds
  const localHours = date.getHours() +
                     date.getMinutes() / 60 +
                     date.getSeconds() / 3600 +
                     date.getMilliseconds() / 3600000;

  const lightHours = ((localHours - solarTimes.sunrise) + 24) % 24;
  const isDaylight = lightHours < daylightHours;
  const segmentLength = isDaylight ? daylightHours / 12 : (24 - daylightHours) / 12;
  const segmentPosition = isDaylight ? lightHours / segmentLength : (lightHours - daylightHours) / segmentLength;

  // Continuous fractional values for rendering smooth hands
  const rawSecond = (((segmentPosition % 1) * 60) % 1) * 60;
  const rawMinute = (segmentPosition % 1) * 60;
  const rawAlanHour = (segmentPosition + (isDaylight ? 6 : 18)) % 24;

  // Integer truncated values for the digital display readout
  const intHour = Math.floor(segmentPosition);
  const intMinute = Math.floor(rawMinute);
  const intSecond = Math.floor(rawSecond);
  const alanHour = (intHour + (isDaylight ? 6 : 18)) % 24;
  const displayHour = alanHour % 12 || 12;
  const period = alanHour < 12 ? "AM" : "PM";

  return {
    hour: rawAlanHour,
    minute: rawMinute,
    second: rawSecond,
    intHour: alanHour,
    intMinute,
    intSecond,
    displayHour,
    period
  };
}

function getNewTime(input_date, latitude = 40.4173, longitude = -82.9071){
  const alanTime = getAlanTimeParts(input_date, latitude, longitude);
  return `${alanTime.displayHour}:${String(alanTime.intMinute).padStart(2, "0")}:${String(alanTime.intSecond).padStart(2, "0")} ${alanTime.period}`;
}

function drawClockFace(canvas, time, accentColor, hourDialSize = 12, minorTickCount = 60, extraHand = null, showHourMinuteHands = true){
  const context = canvas.getContext && canvas.getContext("2d");
  if (!context) {
    return;
  }

  const size = canvas.width;
  const center = size / 2;
  const radius = center - 12;
  context.clearRect(0, 0, size, size);
  context.fillStyle = "#fffaf0";
  context.beginPath();
  context.arc(center, center, radius, 0, 2 * Math.PI);
  context.fill();
  context.strokeStyle = "#17211f";
  context.lineWidth = 4;
  context.stroke();

  for (let mark = 0; mark < minorTickCount; mark += 1) {
    const angle = mark * 2 * Math.PI / minorTickCount - Math.PI / 2;
    const innerRadius = radius - 9;
    context.beginPath();
    context.moveTo(center + Math.cos(angle) * innerRadius, center + Math.sin(angle) * innerRadius);
    context.lineTo(center + Math.cos(angle) * (radius - 4), center + Math.sin(angle) * (radius - 4));
    context.lineWidth = 1;
    context.stroke();
  }

  // Major divisions match the hour dial (12 or 24) instead of always following the minute marks
  for (let mark = 0; mark < hourDialSize; mark += 1) {
    const angle = mark * 2 * Math.PI / hourDialSize - Math.PI / 2;
    const innerRadius = radius - 18;
    context.beginPath();
    context.moveTo(center + Math.cos(angle) * innerRadius, center + Math.sin(angle) * innerRadius);
    context.lineTo(center + Math.cos(angle) * (radius - 4), center + Math.sin(angle) * (radius - 4));
    context.lineWidth = 3;
    context.stroke();
  }

  const drawHand = (angle, length, width, color) => {
    context.beginPath();
    context.moveTo(center, center);
    context.lineTo(center + Math.cos(angle) * length, center + Math.sin(angle) * length);
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineCap = "round";
    context.stroke();
  };

  // Hour Hand (smoothly incorporates fractional minute, sweeps the full dial once per hourDialSize hours)
  if (showHourMinuteHands) {
    drawHand(((time.hour % hourDialSize) * 2 * Math.PI / hourDialSize) - Math.PI / 2, radius * 0.52, 7, "#17211f");
    // Minute Hand (smoothly incorporates fractional second)
    drawHand((time.minute * Math.PI / 30) - Math.PI / 2, radius * 0.74, 5, "#17211f");
  }
  // Second Hand (smooth continuous sweep)
  drawHand((time.second * Math.PI / 30) - Math.PI / 2, radius * 0.8, 2, accentColor);

  // Optional 4th hand for clocks that need to track more than hour/minute/second
  if (extraHand) {
    drawHand((extraHand.value * Math.PI / 30) - Math.PI / 2, radius * 0.86, 2, extraHand.color);
  }

  context.fillStyle = accentColor;
  context.beginPath();
  context.arc(center, center, 7, 0, 2 * Math.PI);
  context.fill();
}
