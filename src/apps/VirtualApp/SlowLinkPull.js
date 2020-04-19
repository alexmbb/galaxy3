const MAX_REPEATS       = 5;
const CHECKING_TIME_MLS = 5000;
const LOST_GOOD        = 100;
const LOST_BAD         = 500;

let list                        = [];
let myId, status                 = enumSlowLinkStatus.wait;
export const enumSlowLinkStatus = { good: 1, bad: 2, critical: 3, wait: -1 };
export default { init, add, getStatus };

function init(id) {
  myId = myId;
}

function add(lost, mid) {
  if (mid !== myId)
    return;
  const now = Date.now();

  if (list.slice(-1)[0] - now < CHECKING_TIME_MLS) {
    list  = [{ timestamp: now, lost: lost }];
    status = enumSlowLinkStatus.wait;
    return;
  }

  if (list.length < MAX_REPEATS) {
    list.push({ timestamp: now, lost: lost });
    status = enumSlowLinkStatus.wait;
    return;
  }

  list.pop().push({ timestamp: now, lost: lost });
  calculateSatus();
};

function calculateSatus() {
  const avarage = list.reduce((s, x) => s + x.timestamp, 0) / MAX_REPEATS;
  switch (true) {
  case avarage <= LOST_GOOD:
    status = enumSlowLinkStatus.good;
    break;
  case avarage <= LOST_BAD:
    status = enumSlowLinkStatus.bad;
    break;
  default:
    status = enumSlowLinkStatus.critical;
  }
  console.log('SlowLinkPull update status to: ', status)
}

function getStatus() {
  return status;
}
