/**
 * The cost field, and the routes read out of it.
 *
 * This is the first thing in the game that works out where an applicant goes
 * rather than being told. The other two modes hand out a route written down in
 * path.js, and the whole of what they vary is how far off it somebody walks.
 * The back channel has no route written down at all: it has a floor, a desk in
 * the corner of it, and a set of screening mechanisms that make the ground
 * around them expensive to cross.
 *
 * Nothing is ever blocked, which is the decision the rest of this file follows
 * from. A tower does not wall a cell off, it adds `threat` to every cell inside
 * its range, and an applicant takes the cheapest way to the desk rather than
 * the shortest. So there is no maze to build, no route to seal by accident, and
 * no need to ever refuse a placement on the grounds that it would trap
 * somebody. A tower nobody can get round is not a screening process, it is a
 * locked door, and this game is not about locked doors.
 *
 * How much an applicant minds is `caution`, on the type. A Graduate applies to
 * everything and walks in a straight line at the desk. The Overqualified has
 * seen a knockout question before and goes the long way round. That is the same
 * number for every cell, so the routing is one Dijkstra per applicant type over
 * a board of a few hundred cells, run when the board changes rather than per
 * frame.
 *
 * Immunity is read here as well as by the towers, and it is the joke the mode
 * is worth building for: the Keyword Stuffer walks straight through a Keyword
 * Filter's field because a Keyword Filter has nothing to say to it, so the
 * ground a filter makes expensive for everybody else is free ground to the one
 * type it cannot touch.
 */
import { APPLICANTS } from '../config/applicants.js';

/**
 * The eight ways out of a cell, and what each step costs before the ground
 * underneath it is taken into account. Diagonals are allowed because nothing is
 * blocked, so there is no corner for anybody to cut through.
 */
const DIAGONAL = Math.SQRT2;
const NEIGHBOURS = [
  { dx: 1, dy: 0, step: 1 },
  { dx: -1, dy: 0, step: 1 },
  { dx: 0, dy: 1, step: 1 },
  { dx: 0, dy: -1, step: 1 },
  { dx: 1, dy: 1, step: DIAGONAL },
  { dx: 1, dy: -1, step: DIAGONAL },
  { dx: -1, dy: 1, step: DIAGONAL },
  { dx: -1, dy: -1, step: DIAGONAL }
];

/**
 * The caution the board is drawn for, which is nobody in particular. The
 * preview lines have to describe the mode rather than one applicant type, and
 * a type has to be picked to draw them from, so this is a middling one that
 * minds a normal amount and is immune to nothing.
 */
const PREVIEW_CAUTION = 1;
const PREVIEW_KEY = 'preview';

/**
 * How far off a straight line three points have to be before the middle one is
 * worth keeping, in square pixels of the triangle they make. Cell centres come
 * out of the walk below in long straight runs, and a path of forty short
 * segments walks exactly the same as a path of four long ones.
 */
const COLLINEAR = 40;

/**
 * How finely a straight line is priced when the route is being pulled taut, as
 * a fraction of a cell. Half a cell cannot miss anything a whole cell wide.
 */
const SAMPLE = 0.5;

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

export default class CostField {
  constructor(field) {
    this.field = field;
    this.columns = Math.round(
      (field.bounds.right - field.bounds.left) / field.cell
    );
    this.rows = Math.round(
      (field.bounds.bottom - field.bounds.top) / field.cell
    );
    this.count = this.columns * this.rows;

    const goal = this.cellAt(field.vacancy.x, field.vacancy.y);

    this.goalIndex = this.index(goal.cx, goal.cy);

    // What the board looks like to somebody who minds a normal amount, kept
    // separately from the routing because it is what gets drawn. Immunity is
    // deliberately not applied to it: the shading says what the screening
    // covers, not what any one applicant thinks of it.
    this.threat = new Float32Array(this.count);
    this.worstThreat = 0;

    // Per applicant type: how far every cell is from the desk, and what
    // crossing every cell costs. The first is what the route is read off, the
    // second is what a straight line has to be priced against before the route
    // is allowed to take one.
    this.fields = new Map();

    this.update([]);
  }

  index(cx, cy) {
    return cy * this.columns + cx;
  }

  /**
   * The cell a board position falls in, clamped to the field. Applicants walk
   * on from off the left edge and the desk sits in the last column, so being
   * asked about a point outside the field is normal rather than a mistake.
   */
  cellAt(x, y) {
    const { bounds, cell } = this.field;

    return {
      cx: clamp(Math.floor((x - bounds.left) / cell), 0, this.columns - 1),
      cy: clamp(Math.floor((y - bounds.top) / cell), 0, this.rows - 1)
    };
  }

  centreOf(cx, cy) {
    const { bounds, cell } = this.field;

    return {
      x: bounds.left + cx * cell + cell / 2,
      y: bounds.top + cy * cell + cell / 2
    };
  }

  /**
   * The board has changed, so everything downstream of it is worked out again.
   * Called when a tower is installed and at no other time, since nothing else
   * on the board moves.
   *
   * The threat each tower type lays down is gathered per type rather than
   * summed into one number, because an applicant immune to a tower type has to
   * be able to take that type's contribution back off again.
   */
  update(towers) {
    const byTower = new Map();

    towers.forEach((tower) => {
      const threat = tower.definition.threat;

      if (!threat) {
        return;
      }

      let cells = byTower.get(tower.typeKey);

      if (!cells) {
        cells = new Float32Array(this.count);
        byTower.set(tower.typeKey, cells);
      }

      this.eachCell((cx, cy, index) => {
        const centre = this.centreOf(cx, cy);

        if (Math.hypot(centre.x - tower.x, centre.y - tower.y) <= tower.definition.range) {
          cells[index] += threat;
        }
      });
    });

    this.threat = new Float32Array(this.count);

    byTower.forEach((cells) => {
      for (let i = 0; i < this.count; i += 1) {
        this.threat[i] += cells[i];
      }
    });

    this.worstThreat = this.threat.reduce((most, value) => Math.max(most, value), 0);

    this.fields = new Map();

    Object.entries(APPLICANTS).forEach(([key, definition]) => {
      this.fields.set(
        key,
        this.measure(byTower, definition.caution ?? 0, definition.immuneTo)
      );
    });

    this.fields.set(
      PREVIEW_KEY,
      this.measure(byTower, PREVIEW_CAUTION, undefined)
    );
  }

  measure(byTower, caution, immuneTo) {
    const cost = this.costFor(byTower, caution, immuneTo);

    return { cost, distance: this.flood(cost) };
  }

  eachCell(callback) {
    for (let cy = 0; cy < this.rows; cy += 1) {
      for (let cx = 0; cx < this.columns; cx += 1) {
        callback(cx, cy, this.index(cx, cy));
      }
    }
  }

  /**
   * What crossing each cell costs somebody with this much caution. One is bare
   * carpet, and everything above that is screening they would rather not walk
   * through. A tower they are immune to is carpet again.
   */
  costFor(byTower, caution, immuneTo) {
    const cost = new Float32Array(this.count).fill(1);

    byTower.forEach((cells, towerKey) => {
      if (immuneTo && immuneTo.includes(towerKey)) {
        return;
      }

      for (let i = 0; i < this.count; i += 1) {
        cost[i] += caution * cells[i];
      }
    });

    return cost;
  }

  /**
   * How far every cell is from the desk, measured in cost rather than in
   * pixels. Dijkstra outwards from the vacancy, so one pass answers the
   * question for every applicant of this type wherever they happen to be
   * standing, and a re-route later is a walk downhill rather than a search.
   *
   * The queue is a scan of the whole board for the nearest unsettled cell,
   * which is the wrong data structure and the right decision: the board is a
   * few hundred cells, this runs when a tower is installed rather than per
   * frame, and a binary heap here would be thirty lines of code to save a
   * fraction of a millisecond nobody would ever notice.
   */
  flood(cost) {
    const distance = new Float32Array(this.count).fill(Infinity);
    const settled = new Uint8Array(this.count);

    distance[this.goalIndex] = 0;

    for (let pass = 0; pass < this.count; pass += 1) {
      let here = -1;
      let nearest = Infinity;

      for (let i = 0; i < this.count; i += 1) {
        if (!settled[i] && distance[i] < nearest) {
          nearest = distance[i];
          here = i;
        }
      }

      if (here === -1) {
        break;
      }

      settled[here] = 1;

      const cx = here % this.columns;
      const cy = (here - cx) / this.columns;

      NEIGHBOURS.forEach(({ dx, dy, step }) => {
        const nx = cx + dx;
        const ny = cy + dy;

        if (nx < 0 || ny < 0 || nx >= this.columns || ny >= this.rows) {
          return;
        }

        const neighbour = this.index(nx, ny);
        // Coming from the neighbour costs it the ground it is stepping on to,
        // which is this cell, plus whatever this cell already costs to finish
        // from.
        const through = nearest + step * cost[here];

        if (through < distance[neighbour]) {
          distance[neighbour] = through;
        }
      });
    }

    return distance;
  }

  /**
   * The way to the desk from a point on the board, as a list of points to walk
   * through. The cell the applicant is standing in is not one of them: they are
   * already in it, and sending them back to the middle of it first is how a
   * re-route turns into a visible flinch backwards.
   *
   * The last point is the vacancy itself rather than the middle of the cell it
   * sits in, so however far apart they came in, everybody finishes at the one
   * desk. That is the same promise the open advert spine makes by tapering its
   * spread to nothing, kept a different way.
   */
  routeFrom(x, y, typeKey) {
    const { cost, distance } =
      this.fields.get(typeKey) ?? this.fields.get(PREVIEW_KEY);
    const points = [];

    let { cx, cy } = this.cellAt(x, y);

    for (
      let steps = 0;
      steps < this.count && this.index(cx, cy) !== this.goalIndex;
      steps += 1
    ) {
      const next = this.downhill(cx, cy, cost, distance);

      // Nowhere better to stand. Only the desk itself should manage this, so
      // anybody who does is pointed straight at it and the walk carries on.
      if (!next) {
        break;
      }

      cx = next.cx;
      cy = next.cy;

      if (this.index(cx, cy) !== this.goalIndex) {
        points.push(this.centreOf(cx, cy));
      }
    }

    points.push({ ...this.field.vacancy });

    return this.pull({ x, y }, this.straighten(points), cost);
  }

  /**
   * The route the board is drawn with, from a point on the left edge. Nobody in
   * particular walks it: it is what the screening currently costs somebody who
   * is paying attention, which is the only way a player can see what a tower
   * did to the flow without waiting for the next intake to walk through it.
   */
  previewRoute(y) {
    return this.routeFrom(this.field.entry.x, y, PREVIEW_KEY);
  }

  /**
   * The next cell along, or null if standing still is already the best anybody
   * can do, which only the desk itself should ever manage.
   *
   * The cell picked is the one that is cheapest to step on to and then finish
   * from, which is not at all the same as the one nearest the desk. A cell in
   * the middle of a Knockout Question's ground is very near the desk and very
   * expensive to stand in, and a walk that only reads how near a cell is walks
   * straight through the thing the whole mode is about avoiding.
   *
   * Cells further from the desk than this one are refused outright. The
   * distance strictly drops along any route the flood found, since every step
   * costs something, so that is a free guarantee against walking in circles.
   */
  downhill(cx, cy, cost, distance) {
    const here = distance[this.index(cx, cy)];

    let best = Infinity;
    let found = null;

    NEIGHBOURS.forEach(({ dx, dy, step }) => {
      const nx = cx + dx;
      const ny = cy + dy;

      if (nx < 0 || ny < 0 || nx >= this.columns || ny >= this.rows) {
        return;
      }

      const neighbour = this.index(nx, ny);
      const there = distance[neighbour];

      if (there >= here) {
        return;
      }

      const through = step * cost[neighbour] + there;

      if (through < best) {
        best = through;
        found = { cx: nx, cy: ny };
      }
    });

    return found;
  }

  /**
   * Drops the points that sit on the line between their neighbours. A straight
   * run across six cells is one segment rather than six, which is the same walk
   * with less of a path to build.
   */
  /**
   * Pulls the route taut.
   *
   * What comes out of the walk downhill is a chain of cell centres, and a grid
   * only knows eight directions, so an applicant crossing open carpet at a
   * shallow angle gets a route that runs diagonally until it is level with the
   * desk and then straight along one row. Every applicant coming in at every
   * height does the same thing and ends up on the same row, which rebuilds the
   * single file queue this mode exists to be the opposite of.
   *
   * So each point is joined to the furthest later point it can reach without
   * the straight line costing more than going round by the cells. On bare
   * carpet that is the whole route in one segment, and everybody walks their own
   * line in from wherever they arrived. Where there is screening in the way the
   * straight line prices itself out and the detour stays exactly as the grid
   * found it.
   *
   * The line is priced by sampling rather than by anything clever, because a
   * segment is at most a board wide and half a cell cannot miss a tower.
   */
  pull(start, points, cost) {
    const pulled = [];

    let from = start;
    let index = 0;

    while (index < points.length) {
      let chain = 0;
      let along = from;
      let furthest = index;

      for (let next = index; next < points.length; next += 1) {
        chain += this.segmentCost(along, points[next], cost);
        along = points[next];

        if (this.segmentCost(from, points[next], cost) <= chain) {
          furthest = next;
        }
      }

      pulled.push(points[furthest]);

      from = points[furthest];
      index = furthest + 1;
    }

    return pulled;
  }

  /**
   * What walking a straight line between two points costs, which is the average
   * cost of the ground under it times how long it is. Averaged rather than
   * summed so that two lines of different lengths can be compared at all.
   */
  segmentCost(from, to, cost) {
    const length = Math.hypot(to.x - from.x, to.y - from.y);

    if (length === 0) {
      return 0;
    }

    const samples = Math.ceil(length / (this.field.cell * SAMPLE));

    let total = 0;

    for (let sample = 0; sample < samples; sample += 1) {
      const along = (sample + 0.5) / samples;
      const cell = this.cellAt(
        from.x + (to.x - from.x) * along,
        from.y + (to.y - from.y) * along
      );

      total += cost[this.index(cell.cx, cell.cy)];
    }

    return (total / samples) * length;
  }

  straighten(points) {
    return points.filter((point, index) => {
      const before = points[index - 1];
      const after = points[index + 1];

      if (!before || !after) {
        return true;
      }

      const area = Math.abs(
        (point.x - before.x) * (after.y - before.y) -
          (after.x - before.x) * (point.y - before.y)
      );

      return area > COLLINEAR;
    });
  }
}
