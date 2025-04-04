function getData() {
  let url = `https://api-skizzlehr.tech/api/v1/login-details/`;

  fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      authorization: `Bearer ${localStorage["access_token"]}`,
      ["x-dts-schema"]: "https://drcsystems.skizzlehr.com",
      ["content-type"]: "application/json",
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        console.error("Error Response:", text); // This will log any HTML error page
        throw new Error("HTTP Error " + response.status);
      }
      return response.json();
    })
    .then((data) => {
      if (typeof data.data.employee_id !== "undefined") {
        const empId = data.data.employee_id;
        const Month = new Date().toLocaleString("default", { month: "long" });
        const Year = new Date().getFullYear();
        if (Year && Month && empId > 0) {
          const url = `https://api-skizzlehr.tech/attendance/api/v1/profile-attendance-calender/${empId}/?attendance_month=${Month}&attendance_year=${Year}`;

          fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json, text/plain, */*",
              authorization: `Bearer ${localStorage["access_token"]}`,
              ["x-dts-schema"]: "https://drcsystems.skizzlehr.com",
              ["content-type"]: "application/json",
            },
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error("Network response was not ok");
              }
              return response.json();
            })
            .then((data) => {
              const attendanceData = data.ouput_data;
              const today = new Date().toISOString().split("T")[0];
              const punches =
                attendanceData.find((item) => item.date === today)?.punches ||
                [];
              const punchTimes = punches.map((p) => p.punch_time);

              // Combine punch status and time
              const punchData = punches.map((p) => ({
                punch_time: p.punch_time,
                punch_inout: p.punch_inout,
              }));

              // Call openModal with punchData
              calculateWorkedTime(punchTimes, punchData);
            })
            .catch((error) => {
              console.error("Fetch error:", error);
            });
        }
      }
    })
    .catch((error) => {
      console.error("Fetch Error:", error);
    });
}

function calculateWorkedTime(times, punchData) {
  let timePairs = createTimePairs(times);
  const requiredHour = "07:30:00";
  const requiredMinutes = hourToMinutes(requiredHour);
  let hours, minutes, completedMinutes;

  if (timePairs.length == 1) {
    const firstIn = hourToMinutes(timePairs[0]);
    completedMinutes = firstIn + requiredMinutes;
  } else {
    const diffMinutes = [];
    timePairs.forEach((pair) => {
      const inPunch = hourToMinutes(pair[0]);
      const outPunch = hourToMinutes(pair[1]);
      diffMinutes.push(outPunch - inPunch);
    });

    let totalWorkMinutes = diffMinutes.reduce(
      (acc, num) => acc + (num || 0),
      0,
    );
    let remainingMinutes = requiredMinutes - totalWorkMinutes;
    let lastInPunch = hourToMinutes(times.at(-1));
    completedMinutes = lastInPunch + remainingMinutes;
  }

  hours = Math.floor(completedMinutes / 60);
  minutes = Math.floor(completedMinutes % 60);
  seconds = Math.round((completedMinutes % 1) * 60);

  const timeObj = {
    timeOver: to12HourFormat(hours + ":" + minutes + ":" + seconds),
    currentTimeMinutes: getCurrentTimeInMinutes(),
    completedMinutes: completedMinutes,
    halDayObj: calculateHalfDay(times),
  };

  // Pass punchData to openModal
  openModal(timeObj, punchData);
}

function calculateHalfDay(times) {
  // times = ["09:30:31", "13:16:00", "13:45:00"];
  let timePairs = createTimePairs(times);
  const requiredHalfDayHour = "03:45:00";
  const requiredHalfDayMinutes = hourToMinutes(requiredHalfDayHour);
  let hours, minutes, completedMinutes;

  if (timePairs.length === 1) {
    const firstIn = hourToMinutes(timePairs[0]); // Only the "IN" time
    completedMinutes = firstIn + requiredHalfDayMinutes;
  } else {
    const diffMinutes = [];
    timePairs.forEach((pair) => {
      const inPunch = hourToMinutes(pair[0]);
      const outPunch = hourToMinutes(pair[1]);
      diffMinutes.push(outPunch - inPunch);
    });

    let totalWorkMinutes = diffMinutes.reduce(
      (acc, num) => acc + (num || 0),
      0,
    );
    if (totalWorkMinutes >= requiredHalfDayMinutes) {
      completedMinutes = hourToMinutes(times.at(0)) + requiredHalfDayMinutes; // Already met/exceeded half-day time
    } else {
      let remainingMinutes = requiredHalfDayMinutes - totalWorkMinutes;
      let lastInPunch = hourToMinutes(times.at(-1)); // Last IN time in minutes
      completedMinutes = lastInPunch + remainingMinutes;
    }
  }

  hours = Math.floor(completedMinutes / 60);
  minutes = Math.floor(completedMinutes % 60);
  seconds = Math.round((completedMinutes % 1) * 60);

  const timeObj = {
    halfDayOver: to12HourFormat(hours + ":" + minutes + ":" + seconds),
    halfDayCurrentTimeMinutes: getCurrentTimeInMinutes(),
    halfDayCompletedMinutes: completedMinutes,
  };

  return timeObj;
}

function createTimePairs(times) {
  let pairs = [];
  if (times.length > 1) {
    for (let i = 0; i < times.length - 1; i += 2) {
      pairs.push([times[i], times[i + 1]]);
    }
    // If there's an unpaired element, store it separately
    if (times.length % 2 !== 0) {
      pairs.push([times[times.length - 1], "Incomplete Punch"]);
    }
    return pairs;
  } else {
    return times;
  }
}

// Function to convert time (HH:MM:SS) into total minutes including seconds
function hourToMinutes(hour) {
  const [hours, minutes, seconds] = hour.split(":").map(Number);
  return hours * 60 + minutes + seconds / 60;  // Including seconds
}

// Function to convert minutes back to HH:MM format (with AM/PM)
function to12HourFormat(time) {
  let [hours, minutes, seconds] = time.split(":").map(Number);
  let period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // Convert 0 or 12 to 12, otherwise keep remainder

  // Ensure minutes and seconds are always two digits
  minutes = String(minutes).padStart(2, "0");
  seconds = seconds !== undefined ? String(seconds).padStart(2, "0") : "00";

  return `${hours}:${minutes}:${seconds} ${period}`;
}

// Function to calculate the current time in minutes (including seconds)
function getCurrentTimeInMinutes() {
  let now = new Date();
  let hours = now.getHours();  // Get current hours (0-23)
  let minutes = now.getMinutes();  // Get current minutes
  let seconds = now.getSeconds();  // Get current seconds
  let totalMinutes = hours * 60 + minutes + seconds / 60;  // Convert to total minutes, including seconds
  return totalMinutes;
}

function getAllEmpData() {
  // let url = `https://api-skizzlehr.tech/organization/api/v1/employee-dropdown-list-all/?ordering=user__first_name&is_active=true&employment_status=[%22Confirmed%22,%22Probation%22,%22Resigned%22]`;
  let url = `https://api-skizzlehr.tech/attendance/api/v1/profile-leave-type-employee-dropdown/?search=&id=157&year=2025`;

  fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      authorization: `Bearer ${localStorage["access_token"]}`,
      ["x-dts-schema"]: "https://drcsystems.skizzlehr.com",
      ["content-type"]: "application/json",
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        console.error("Error Response:", text); // This will log any HTML error page
        throw new Error("HTTP Error " + response.status);
      }
      return response.json();
    })
    .then((data) => {
      console.log(data)
    })
    .catch((error) => {
      console.error("Fetch Error:", error);
    });
}

function openModal(timeObj, punchData) {
  const modal = document.getElementById("timeOverModal");
  if (modal) {
    let myModal = new bootstrap.Modal(modal);
    myModal.hide(); // Hide any existing modal before updating
  }

  let isTimeOver = timeObj.currentTimeMinutes >= timeObj.completedMinutes;
  let isHalfDayOver =
    timeObj.halDayObj.halfDayCurrentTimeMinutes >=
    timeObj.halDayObj.halfDayCompletedMinutes;

  // Create a Punch History Table
  let punchHistoryHTML = punchData
    .map((punch, index) => {
      let status = punch.punch_inout ? "Out" : "In"; // Convert boolean to "In" or "Out"
      let rowClass = punch.punch_inout ? "table-warning" : "table-info";
      return `
        <tr class="${rowClass}">
            <td>${index + 1}</td>
            <td>${to12HourFormat(punch.punch_time)}</td>
            <td class="fw-bold">${status}</td>
        </tr>`;
    })
    .join("");

  const htmlModal = `
<div class="modal fade" id="timeOverModal" tabindex="-1" aria-labelledby="timeOverModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg border-0 rounded-4">

            <!-- Modal Header -->
            <div class="modal-header ${isTimeOver ? 'bg-success' : 'bg-danger'} text-white">
                <h5 class="modal-title fw-bold" id="timeOverModalLabel">
                    <i class="${isTimeOver ? 'bi bi-check-circle-fill' : 'bi bi-exclamation-triangle-fill'} me-2"></i>
                    ${isTimeOver ? 'Task Completed' : 'Pending Work Hours'}
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <!-- Modal Body -->
            <div class="modal-body text-center bg-light rounded-bottom-4">
                <p class="lead fw-semibold text-dark">
                    ${isTimeOver ? 'Great job! You have completed your required hours.' : 'Keep going! Some hours are still pending.'}
                </p>

                <!-- Work Hours Table -->
                <div class="table-responsive">
                    <table class="table table-bordered mt-3">
                        <thead class="table-dark">
                            <tr>
                                <th scope="col" class="text-uppercase">Hour</th>
                                <th scope="col" class="text-uppercase">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="${isTimeOver ? 'table-success' : 'table-danger'} text-white fw-bold">
                                <td>07 Hour 30 Minutes</td>
                                <td>${timeObj.timeOver}</td>
                            </tr>
                            <tr class="${isHalfDayOver ? 'table-success' : 'table-danger'} text-white fw-bold">
                                <td>03 Hour 45 Minutes</td>
                                <td>${timeObj.halDayObj.halfDayOver}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Punch History Table -->
                <h5 class="mt-4 text-dark fw-bold">Punch History</h5>
                <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                    <table class="table table-bordered mt-2">
                        <thead class="table-secondary">
                            <tr>
                                <th>#</th>
                                <th>Punch Time</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${punchHistoryHTML}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="modal-footer justify-content-center">
                <button type="button" class="btn ${
                  isTimeOver ? "btn-success" : "btn-danger"
                } px-4" data-bs-dismiss="modal">
                    <i class="bi bi-x-circle me-1"></i> Close
                </button>
            </div>

        </div>
    </div>
</div>

`;

  // Inject the modal HTML into the page
  document.body.insertAdjacentHTML("beforeend", htmlModal);
  let myNewModal = new bootstrap.Modal(
    document.getElementById("timeOverModal"),
  );
  myNewModal.show(); // Show modal
}

getAllEmpData();

getData();
