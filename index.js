const axios = require("axios");
const fs = require("fs");
const path = require("path");
const API_URL = "https://api.sunrise-sunset.org/json";

async function fetchSunsetSunriseData(lat, lng, year) {
  const responses = [];
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  // let currentRequestNumber = 0;

  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= daysInMonth[month - 1]; day++) {
      try {
        const response = await axios.get(
          `${API_URL}?lat=${lat}&lng=${lng}&date=${year}-${month}-${day}&tzid=Pacific/Auckland`
        );
        if (response.data.status === "OK") {
          responses.push(response.data.results);
        }

        console.log(`Fetched data for ${year}-${month}-${day}`);

        // currentRequestNumber++;

        //break after 10 requests for testing
        // if (currentRequestNumber === 7) {
        //   break;
        // }
      } catch (error) {
        console.error(
          `Failed to fetch data for ${year}-${month}-${day}:`,
          error
        );
      }
    }

    //break after 10 requests for testing
    // if (currentRequestNumber === 7) {
    //   break;
    // }
  }
  return responses;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function convertToISOTime(timeStr) {
  if (!timeStr) return null;
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes, seconds] = time.split(":");
  if (modifier === "PM" && hours !== "12") {
    hours = parseInt(hours, 10) + 12;
  }
  if (modifier === "AM" && hours === "12") {
    hours = "00";
  }
  return `${hours}:${minutes}:${seconds}`;
}

async function calculateWeeklyAverages() {
  const data = await fetchSunsetSunriseData(-41.2865, 174.7762, 2023);
  const weeklyData = [];

  for (let i = 0; i < data.length; i += 7) {
    const weekData = data.slice(i, i + 7).filter((day) => day);
    if (weekData.length === 0) continue;

    try {
      const avgSunrise =
        weekData.reduce((acc, curr) => {
          const sunriseTime = convertToISOTime(curr.sunrise);
          if (!sunriseTime) {
            console.error(`Invalid sunrise time: ${curr.sunrise}`);
            return acc;
          }
          return (
            acc + new Date(`1970-01-01 ${sunriseTime} GMT+00:00`).getTime()
          );
        }, 0) / weekData.length;

      const avgSunset =
        weekData.reduce((acc, curr) => {
          const sunsetTime = convertToISOTime(curr.sunset);
          if (!sunsetTime) {
            console.error(`Invalid sunset time: ${curr.sunset}`);
            return acc;
          }
          return acc + new Date(`1970-01-01 ${sunsetTime} GMT+00:00`).getTime();
        }, 0) / weekData.length;

      if (!isNaN(avgSunrise) && !isNaN(avgSunset)) {
        weeklyData.push({
          week: Math.floor(i / 7) + 1,
          avgSunrise: new Date(avgSunrise).toISOString().substring(11, 16),
          avgSunset: new Date(avgSunset).toISOString().substring(11, 16),
        });
      } else {
        console.error(
          `Invalid average time values for week ${Math.floor(i / 7) + 1}`
        );
      }
    } catch (error) {
      console.error(
        `Failed to calculate averages for week ${Math.floor(i / 7) + 1}:`,
        error
      );
    }
  }
  return weeklyData;
}

// create a new CSV file and store the data
const createCSV = (data) => {
  const csv = data.map((item) => {
    return `${item.week},${item.avgSunrise},${item.avgSunset}`;
  });

  fs.writeFileSync("weekly-sunrise-sunset.csv", csv.join("\n"));
};

async function saveInConfigAndCSV() {
  const data = await calculateWeeklyAverages();
  createCSV(data);

  const configPath = path.resolve(__dirname, "../config/config.js");

  const config = fs.readFileSync(configPath, "utf8");
  const weeklyAverageSunTimes = data.map((item) => {
    return `{ week: ${item.week}, sunrise: "${item.avgSunrise}", sunset: "${item.avgSunset}" }`;
  });

  const updatedConfig = config.replace(
    /weeklyAverageSunTimes: \[.*\]/,
    `weeklyAverageSunTimes: [${weeklyAverageSunTimes.join(",")}]`
  );

  fs.writeFileSync(configPath, updatedConfig);

  console.log("Data saved in CSV and config.js");
}

saveInConfigAndCSV();
