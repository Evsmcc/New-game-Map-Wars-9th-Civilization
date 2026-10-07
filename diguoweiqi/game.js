/* ============================================================
 * 奇趣落子棋 —— 15 路落子棋（含围棋式吃子）
 * 黑红轮流落子；每落一子，其上下左右的空白格必定长出特殊棋子，
 * 同时该格迷雾被揭开。
 *
 * 特殊棋子属性（每种 4 项）：
 *   placeable  可落子 —— 该格能否落普通棋子
 *   sieges     参与围困 —— 计算某方棋子气数时，该格视为敌方棋子（堵气）
 *   capturable 可被吃 —— 该特殊棋子被围住（气=0）时被收走
 *   score      得分 —— 吃掉该棋子的一方获得的分数
 * ============================================================ */

(function () {
  'use strict';

  // ---------- 常量配置 ----------
  var SIZE = 15;

  // 特殊棋子属性表（share：是否分享——相邻的每枚棋子使拥有方持续获得 score/4 分，
  //                  该特殊棋子被吃后光环消失，相邻棋子的分享分同步失去）
  var SPECIALS = {
    '🌾': { name: '麦穗', placeable: false,  sieges: false, capturable: true,  score: 4, share: true },
    '🌲': { name: '林木', placeable: false,  sieges: true, capturable: true,  score: 0, share: false },
    '🐅': { name: '猛虎', placeable: false,  sieges: true, capturable: true,  score: 5, share: false },
    '💎': { name: '宝石', placeable: false,  sieges: true, capturable: false,  score: 12, share: true  },
    '⛰': { name: '山岳', placeable: false, sieges: true,  capturable: false, score: 0, share: false },
    '🟦': { name: '水域', placeable: true,  sieges: false, capturable: false, score: 0, share: false },
    '🟩': { name: '草地', placeable: true,  sieges: false, capturable: false, score: 0, share: false },
    '🟨': { name: '沙漠', placeable: true,  sieges: false, capturable: false, score: -2, share: false },
  };
  var SPECIAL_EMOJIS = Object.keys(SPECIALS);

  // 特殊棋子库（配额表）：按数量组建一副牌，洗牌后逐张抽取，用完重新洗牌
  var POOL_COMPOSITION = {
    '🌾': 15, '⛰': 10, '🌲': 10, '🟦': 15, '🐅': 5, '💎': 5, '🟩': 100, '🟨': 10,
  };
  var pool = [];

  var BLUE_CELL = '#2f7fe0';
  var GREEN_CELL = '#57c465';
  var YELLOW_CELL = '#e1d088ff';         // 沙漠格子：永久浅黄色
  var BLACK_CELL = '#1e1915ff';          // 黑子下方格子：深褐色
  var RED_CELL = '#eae6e7ff';            // 红子下方格子：橘黄色
  var SPECIAL_ALPHA = 0.45;            // emoji 特殊棋子不透明度
  var KILL_SCORE = 5;                  // 每吃对方 1 个棋子的得分
  var KILL_KEY = '__kill__';           // 行囊中“俘虏”条目键
  var PLAYER_EMOJI = { b: '🧛‍♀️', w: '💂‍♂️' };
  var DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var POP_DURATION = 350;

  // ---------- 游戏结束条件 ----------
  var MAX_MOVES = 100;     // 超过 100 手结束
  var SCORE_LIMIT = 100;   // 一方得分超过 100 结束
  var SCORE_GAP = 100;     // 双方分差超过 100 结束

  // ---------- DOM ----------
  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var turnStone = document.getElementById('turnStone');
  var turnText = document.getElementById('turnText');
  var moveCountEl = document.getElementById('moveCount');
  var poolDrawnEl = document.getElementById('poolDrawn');
  var poolTotalEl = document.getElementById('poolTotal');
  var poolGridEl = document.getElementById('poolGrid');
  var panelBlack = document.getElementById('panelBlack');
  var panelWhite = document.getElementById('panelWhite');
  var bagBlack = document.getElementById('bagBlack');
  var bagWhite = document.getElementById('bagWhite');
  var scoreBlackEl = document.getElementById('scoreBlack');
  var scoreWhiteEl = document.getElementById('scoreWhite');
  var capBlackEl = document.getElementById('capBlack');
  var capWhiteEl = document.getElementById('capWhite');
  var legendEl = document.getElementById('legend');
  var resetBtn = document.getElementById('resetBtn');
  var resultOverlay = document.getElementById('resultOverlay');
  var resultEmojiEl = document.getElementById('resultEmoji');
  var resultTitleEl = document.getElementById('resultTitle');
  var resultScoreEl = document.getElementById('resultScore');
  var resultReasonEl = document.getElementById('resultReason');
  var resultResetBtn = document.getElementById('resultReset');

  // ---------- 游戏状态 ----------
  var grid;          // null | 'b' | 'w' | { e, born }
  var revealed;
  var terrain;       // 永久地形：'water' 表示该格曾是水域，落子后仍保持蓝色
  var currentPlayer; // 'b' | 'w'
  var moves;
  var lastMove;
  var gameOver;
  var winner;         // 'b' | 'w' | null（平局）
  var endReason;      // 'moves' | 'score' | 'gap' | 'full'
  var bags;          // { b: {emoji:n}, w: {...} }
  var scores;        // { b: n, w: n }
  var captures;      // { b: n, w: n } 提子数
  var poolDrawn;     // 本局已从棋子库取出的张数
  var poolDrawnByType; // 各类型已取出张数 { emoji: n }
  var poolCountEls;
  var bagCountEls;
  var hover = null;
  var turnHooks = [];   // 回合切换/重开时通知 AI 托管
  function fireTurnHooks() { turnHooks.forEach(function (cb) { try { cb(); } catch (e) {} }); }

  // ---------- 画布几何 ----------
  var viewSize = 0, cell = 0, dpr = 1;

  function resizeCanvas() {
    var cssSize = canvas.clientWidth;
    if (cssSize === 0) return;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    viewSize = cssSize;
    cell = viewSize / SIZE;
  }

  // ---------- 辅助 ----------
  function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function specialOf(v) { return v && v.e ? SPECIALS[v.e] : null; }
  function other(p) { return p === 'b' ? 'w' : 'b'; }

  // 某格是否为“气”（开放空间）：空、☠ 被吃标记、或可落子/不参与围困的特殊棋子
  function isOpen(v) {
    if (v === null) return true;
    if (v && v.skull) return true;
    var s = specialOf(v);
    return s ? (s.placeable || !s.sieges) : false;
  }

  function isPlaceable(r, c) {
    var v = grid[r][c];
    if (v === null) return true;
    var s = specialOf(v);
    return s ? s.placeable : false;
  }

  // ---------- 特殊棋子库 ----------
  function buildPool() {
    pool = [];
    Object.keys(POOL_COMPOSITION).forEach(function (e) {
      for (var i = 0; i < POOL_COMPOSITION[e]; i++) pool.push(e);
    });
    // Fisher–Yates 洗牌
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
  }

  var POOL_TOTAL = Object.keys(POOL_COMPOSITION).reduce(
    function (sum, e) { return sum + POOL_COMPOSITION[e]; }, 0);

  function drawFromPool() {
    if (pool.length === 0) buildPool();
    poolDrawn += 1;
    var e = pool.pop();
    poolDrawnByType[e] = (poolDrawnByType[e] || 0) + 1;
    return e;
  }

  // 提子后恢复格子：水域还原为 🟦，沙漠还原为 🟨，其余还原为 🟩
  function restoreCell(r, c) {
    var now = performance.now();
    if (terrain[r][c] === 'water') {
      grid[r][c] = { e: '🟦', born: now };
    } else if (terrain[r][c] === 'desert') {
      grid[r][c] = { e: '🟨', born: now };
    } else {
      grid[r][c] = { e: '🟩', born: now };
    }
    revealed[r][c] = true;
  }

  // 回合结束（吃子判定完成）后：水域格上的所有棋子消失，水域恢复为 🟦。
  // 返回刚落下的棋子是否也被冲走。
  function sweepWater(lastR, lastC) {
    var placedSwept = false;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (terrain[r][c] === 'water' && (grid[r][c] === 'b' || grid[r][c] === 'w')) {
          restoreCell(r, c);
          if (r === lastR && c === lastC) placedSwept = true;
        }
      }
    }
    return placedSwept;
  }

  // ☠ 死亡标记：吃子结算后放在被吃棋子处，占位一回合以防争子（劫）。
  // 下一次吃子结算判定前，上一批 ☠ 先消失（恢复地形）。
  function clearSkulls() {
    var cleared = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = grid[r][c];
        if (v && v.skull) {
          cleared.push({ r: r, c: c, v: v });
          restoreCell(r, c);
        }
      }
    }
    return cleared;
  }

  function placeSkull(r, c) {
    grid[r][c] = { skull: true, e: '☠', born: performance.now() };
    revealed[r][c] = true;
  }

  // ---------- 初始化 ----------
  function buildBag(container, player) {
    SPECIAL_EMOJIS.forEach(function (emoji) {
      if (SPECIALS[emoji].score === 0) return;   // 不得分的棋子不在行囊显示
      var chip = document.createElement('span');
      chip.className = 'chip empty';
      var icon = document.createElement('span');
      icon.textContent = emoji;
      var scoreTag = document.createElement('i');
      scoreTag.className = 'chip-score-label';
//      scoreTag.textContent = (SPECIALS[emoji].score > 0 ? '+' : '') + SPECIALS[emoji].score;
      var count = document.createElement('i');
      count.className = 'chip-count';
      count.textContent = '0';
      chip.appendChild(icon);
      chip.appendChild(scoreTag);
      chip.appendChild(count);
      container.appendChild(chip);
      bagCountEls[player][emoji] = count;
    });

    // 俘虏条目：吃掉的对方棋子（图标为对方棋子 emoji），每子 6 分
    var killChip = document.createElement('span');
    killChip.className = 'chip chip-kill empty';
    var killIcon = document.createElement('span');
    killIcon.textContent = PLAYER_EMOJI[other(player)];
    var killTitle = document.createElement('i');
    killTitle.className = 'chip-kill-label';
//    killTitle.textContent = '×6';
    var killCount = document.createElement('i');
    killCount.className = 'chip-count';
    killCount.textContent = '0';
    killChip.appendChild(killIcon);
    killChip.appendChild(killTitle);
    killChip.appendChild(killCount);
    container.appendChild(killChip);
    bagCountEls[player][KILL_KEY] = killCount;
  }

  function buildLegend() {
    if (!legendEl) return;
    legendEl.innerHTML = '';
    SPECIAL_EMOJIS.forEach(function (emoji) {
      var s = SPECIALS[emoji];
      var row = document.createElement('div');
      row.className = 'legend-row';
      row.innerHTML =
        '<span class="lg-emoji">' + emoji + '</span>' +
        '<span class="lg-name">' + s.name + '</span>' +
        '<span class="lg-attr" title="可落子">' + (s.placeable ? '✔' : '×') + '</span>' +
        '<span class="lg-attr" title="参与围困">' + (s.sieges ? '✔' : '×') + '</span>' +
        '<span class="lg-attr" title="可被吃">' + (s.capturable ? '✔' : '×') + '</span>' +
        '<span class="lg-attr lg-share" title="分享：相邻棋子每枚获得 1/4 分，被吃后失去">' + (s.share ? '✔' : '×') + '</span>' +
        '<span class="lg-score">' + s.score + '</span>';
      legendEl.appendChild(row);
    });
  }

  function resetGame() {
    grid = []; revealed = []; terrain = [];
    for (var r = 0; r < SIZE; r++) {
      grid.push(new Array(SIZE).fill(null));
      revealed.push(new Array(SIZE).fill(false));
      terrain.push(new Array(SIZE).fill(null));
    }
    currentPlayer = 'b';
    moves = 0;
    lastMove = null;
    gameOver = false;
    winner = null;
    endReason = null;
    hover = null;
    bags = { b: {}, w: {} };
    scores = { b: 0, w: 0 };
    captures = { b: 0, w: 0 };
    poolDrawn = 0;
    poolDrawnByType = {};
    poolCountEls = {};
    if (poolGridEl) {
      poolGridEl.innerHTML = '';
      SPECIAL_EMOJIS.forEach(function (emoji) {
        var cell = document.createElement('span');
        cell.className = 'pcell';
        var icon = document.createElement('i');
        icon.className = 'p-emoji';
        icon.textContent = emoji;
        var drawn = document.createElement('b');
        drawn.className = 'p-drawn';
        drawn.textContent = '0';
        var sep = document.createElement('span');
        sep.className = 'p-sep';
        sep.textContent = '/';
        var total = document.createElement('i');
        total.className = 'p-total';
        total.textContent = String(POOL_COMPOSITION[emoji]);
        cell.appendChild(icon);
        cell.appendChild(drawn);
        cell.appendChild(sep);
        cell.appendChild(total);
        poolGridEl.appendChild(cell);
        poolCountEls[emoji] = drawn;
      });
    }
    bagCountEls = { b: {}, w: {} };
    SPECIAL_EMOJIS.forEach(function (e) { bags.b[e] = 0; bags.w[e] = 0; });
    bags.b[KILL_KEY] = 0; bags.w[KILL_KEY] = 0;
    bagBlack.innerHTML = '';
    bagWhite.innerHTML = '';
    buildBag(bagBlack, 'b');
    buildBag(bagWhite, 'w');
    buildPool();
    if (poolTotalEl) poolTotalEl.textContent = String(POOL_TOTAL);
    updateHud();
    fireTurnHooks();
  }

  // ---------- HUD ----------
  function updateHud() {
    moveCountEl.textContent = String(moves);
    if (poolDrawnEl) poolDrawnEl.textContent = String(poolDrawn);
    SPECIAL_EMOJIS.forEach(function (emoji) {
      if (poolCountEls[emoji]) {
        poolCountEls[emoji].textContent = String(poolDrawnByType[emoji] || 0);
      }
    });
    if (gameOver) {
      turnText.textContent = winner === 'b' ? '对局结束 · 黑方胜'
        : winner === 'w' ? '对局结束 · 红方胜'
        : '对局结束 · 平局';
    } else {
      turnText.textContent = currentPlayer === 'b' ? '黑方落子' : '红方落子';
    }
    turnStone.className = 'turn-stone ' + (gameOver
      ? (winner === 'w' ? 'red' : 'black')
      : (currentPlayer === 'b' ? 'black' : 'red'));
    panelBlack.classList.toggle('active', !gameOver && currentPlayer === 'b');
    panelWhite.classList.toggle('active', !gameOver && currentPlayer === 'w');
    panelBlack.classList.toggle('winner', gameOver && winner === 'b');
    panelWhite.classList.toggle('winner', gameOver && winner === 'w');
    renderResult();

    var totalNow = totalScores();
    var bonusNow = shareBonus();
    scoreBlackEl.textContent = fmtScore(totalNow.b);
    scoreWhiteEl.textContent = fmtScore(totalNow.w);
    scoreBlackEl.title = '固定分 ' + fmtScore(scores.b) +
      (bonusNow.b ? ' ＋ 分享光环 ' + fmtScore(bonusNow.b) : '');
    scoreWhiteEl.title = '固定分 ' + fmtScore(scores.w) +
      (bonusNow.w ? ' ＋ 分享光环 ' + fmtScore(bonusNow.w) : '');
    capBlackEl.textContent = String(captures.b);
    capWhiteEl.textContent = String(captures.w);

    ['b', 'w'].forEach(function (p) {
      SPECIAL_EMOJIS.forEach(function (emoji) {
        var el = bagCountEls[p][emoji];
        if (!el) return;                              // 未在行囊展示的棋子跳过
        var n = bags[p][emoji];
        el.textContent = String(n);
        el.parentElement.classList.toggle('empty', n === 0);
      });
      var kn = captures[p];
      var kel = bagCountEls[p][KILL_KEY];
      kel.textContent = String(kn);
      kel.parentElement.classList.toggle('empty', kn === 0);
    });
  }

  // ---------- 对局结果覆盖层 ----------
  var END_REASON_TEXT = {
    moves: '对局已超过 ' + MAX_MOVES + ' 手',
    score: '一方得分超过 ' + SCORE_LIMIT + ' 分',
    gap: '双方分差超过 ' + SCORE_GAP + ' 分',
    full: '棋盘已无落子点'
  };

  function renderResult() {
    if (!gameOver) {
      resultOverlay.classList.remove('show');
      return;
    }
    if (winner === 'b') {
      resultEmojiEl.textContent = '🧛‍♀️';
      resultTitleEl.textContent = '黑方获胜';
      resultTitleEl.className = 'result-title win-black';
    } else if (winner === 'w') {
      resultEmojiEl.textContent = '💂‍♂️';
      resultTitleEl.textContent = '红方获胜';
      resultTitleEl.className = 'result-title win-red';
    } else {
      resultEmojiEl.textContent = '🤝';
      resultTitleEl.textContent = '平局';
      resultTitleEl.className = 'result-title';
    }
    var rt = totalScores();
    resultScoreEl.innerHTML =
      '<span class="rs-b">' + fmtScore(rt.b) + '</span><i>:</i><span class="rs-w">' + fmtScore(rt.w) + '</span>';
    resultReasonEl.textContent = END_REASON_TEXT[endReason] || '';
    resultOverlay.classList.add('show');
  }

  // ---------- 吃子核心 ----------
  // 取得 (r,c) 所在的同色棋子连通块
  function getStoneGroup(r, c, color) {
    var group = [];
    var visited = {};
    var stack = [[r, c]];
    while (stack.length) {
      var cur = stack.pop();
      var rr = cur[0], cc = cur[1];
      var key = rr + ',' + cc;
      if (visited[key]) continue;
      visited[key] = true;
      if (grid[rr][cc] !== color) continue;
      group.push({ r: rr, c: cc });
      DIRS.forEach(function (d) {
        var nr = rr + d[0], nc = cc + d[1];
        if (inBounds(nr, nc) && !visited[nr + ',' + nc]) stack.push([nr, nc]);
      });
    }
    return group;
  }

  // 计算一个棋子连通块的气数（相邻不重复的开放格数量）
  function countLiberties(group) {
    var libs = {};
    group.forEach(function (cell) {
      DIRS.forEach(function (d) {
        var nr = cell.r + d[0], nc = cell.c + d[1];
        if (inBounds(nr, nc) && isOpen(grid[nr][nc])) libs[nr + ',' + nc] = true;
      });
    });
    return Object.keys(libs).length;
  }

  // 单个特殊棋子格的气数
  function specialLiberties(r, c) {
    var count = 0;
    DIRS.forEach(function (d) {
      var nr = r + d[0], nc = c + d[1];
      if (inBounds(nr, nc) && isOpen(grid[nr][nc])) count++;
    });
    return count;
  }

  // ---------- 分享光环（动态得分层） ----------
  // 每个 share=true 的特殊棋子：四邻每有一枚某方棋子，该方获得 score/4 的光环分。
  // 纯读取、实时计算——特殊棋子被围吃/棋子被提走/水域冲走后，光环分自动消失。
  function shareBonusOn(g) {
    var bonus = { b: 0, w: 0 };
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = g[r][c];
        var def = v && v.e && !v.skull ? SPECIALS[v.e] : null;
        if (!def || !def.share) continue;
        var q = def.score / 4;
        for (var i = 0; i < DIRS.length; i++) {
          var nr = r + DIRS[i][0], nc = c + DIRS[i][1];
          if (!inBounds(nr, nc)) continue;
          var nv = g[nr][nc];
          if (nv === 'b') bonus.b += q;
          else if (nv === 'w') bonus.w += q;
        }
      }
    }
    return bonus;
  }
  function shareBonus() { return shareBonusOn(grid); }
  // 总分 = 固定分（收取/提子）+ 当前分享光环分
  function totalScores() {
    var bn = shareBonus();
    return { b: scores.b + bn.b, w: scores.w + bn.w };
  }
  // 四分之一分为单位，无二进制误差；显示时去掉多余的 .0
  function fmtScore(x) {
    var n = Math.round(x * 100) / 100;
    return String(n);
  }

  // 结算后检查是否满足结束条件，返回原因字符串；不满足返回 null
  function checkGameEnd() {
    var t = totalScores();
    if (moves > MAX_MOVES) return 'moves';
    if (t.b > SCORE_LIMIT || t.w > SCORE_LIMIT) return 'score';
    if (Math.abs(t.b - t.w) > SCORE_GAP) return 'gap';
    return null;
  }

  // ---------- AI 支持：在棋盘克隆上预演落子 ----------
  // 不触发刷棋子/水域等回合末效果，只评估提子、特殊棋子得分与自身气数
  function previewMove(r, c, player) {
    if (!isPlaceable(r, c)) return { legal: false };
    var P = player, O = other(P);
    var orig = grid[r][c];
    var g = grid.map(function (row) { return row.slice(); });
    g[r][c] = P;

    function openAt(gr, gc) {
      var v = g[gr][gc];
      if (v === null) return true;
      if (v && v.skull) return true;
      var s = v && v.e ? SPECIALS[v.e] : null;
      return s ? (s.placeable || !s.sieges) : false;
    }
    function groupAt(gr, gc, color) {
      var stones = [], libs = {}, seen = {}, stack = [[gr, gc]];
      while (stack.length) {
        var cur = stack.pop(), rr = cur[0], cc = cur[1], key = rr + ',' + cc;
        if (seen[key]) continue;
        seen[key] = true;
        if (g[rr][cc] !== color) continue;
        stones.push([rr, cc]);
        DIRS.forEach(function (d) {
          var nr = rr + d[0], nc = cc + d[1];
          if (!inBounds(nr, nc)) return;
          if (openAt(nr, nc)) libs[nr + ',' + nc] = true;
          else if (g[nr][nc] === color) stack.push([nr, nc]);
        });
      }
      return { stones: stones, liberties: Object.keys(libs).length };
    }

    var captured = 0;
    var seenOpp = {};
    DIRS.forEach(function (d) {
      var nr = r + d[0], nc = c + d[1];
      if (inBounds(nr, nc) && g[nr][nc] === O && !seenOpp[nr + ',' + nc]) {
        var gp = groupAt(nr, nc, O);
        gp.stones.forEach(function (s) { seenOpp[s[0] + ',' + s[1]] = true; });
        if (gp.liberties === 0) {
          captured += gp.stones.length;
          gp.stones.forEach(function (s) { g[s[0]][s[1]] = null; });
        }
      }
    });

    var own = groupAt(r, c, P);
    var specialGain = (orig && orig.e) ? SPECIALS[orig.e].score : 0;
    return {
      legal: own.liberties > 0,
      captured: captured,
      ownLiberties: own.liberties,
      special: orig && orig.e ? orig.e : null,
      gain: specialGain + captured * KILL_SCORE
    };
  }

  function placeStone(r, c) {
    if (gameOver || !inBounds(r, c) || !isPlaceable(r, c)) return;

    var v = grid[r][c];
    var placedSpecial = v && v.e ? v : null;
    var P = currentPlayer;
    var O = other(P);

    // 快照，用于自杀回滚
    var snap = { cell: v, stones: [], specials: [], skulls: [] };

    // 落在可落子的特殊棋子上：收进本方行囊并得分
    if (placedSpecial) {
      bags[P][placedSpecial.e] += 1;
      scores[P] += SPECIALS[placedSpecial.e].score;
    }

    grid[r][c] = P;

    // 0) 吃子结算判定前：上一批 ☠ 消失（恢复地形）
    snap.skulls = clearSkulls();

    // 1) 提子：相邻敌方棋子连通块气数为 0 则全部提走
    var capturedCoords = [];
    var visitedOpp = {};
    DIRS.forEach(function (d) {
      var nr = r + d[0], nc = c + d[1];
      if (inBounds(nr, nc) && grid[nr][nc] === O && !visitedOpp[nr + ',' + nc]) {
        var group = getStoneGroup(nr, nc, O);
        group.forEach(function (g) { visitedOpp[g.r + ',' + g.c] = true; });
        if (countLiberties(group) === 0) {
          group.forEach(function (g) {
            snap.stones.push({ r: g.r, c: g.c, v: O });
            grid[g.r][g.c] = null;        // 先提走，结算后在该处放 ☠
            capturedCoords.push({ r: g.r, c: g.c });
            captures[P] += 1;
            bags[P][KILL_KEY] += 1;       // 行囊记录俘虏
            scores[P] += KILL_SCORE;      // 每吃 1 子得 6 分
          });
        }
      }
    });

    // 2) 特殊棋子被吃：全盘可被吃的特殊棋子气数为 0 则收走，归当前玩家得分
    for (var rr = 0; rr < SIZE; rr++) {
      for (var cc = 0; cc < SIZE; cc++) {
        var sv = grid[rr][cc];
        var sdef = specialOf(sv);
        if (sdef && sdef.capturable && specialLiberties(rr, cc) === 0) {
          snap.specials.push({ r: rr, c: cc, v: sv });
          bags[P][sv.e] += 1;
          scores[P] += sdef.score;
          restoreCell(rr, cc);             // 特殊棋子被吃后恢复为 🟦 / 🟩
        }
      }
    }

    // 3) 禁入点（自杀）：若己方棋子连通块气数仍为 0，则此手非法，回滚
    var ownGroup = getStoneGroup(r, c, P);
    if (countLiberties(ownGroup) === 0) {
      grid[r][c] = snap.cell;
      snap.stones.forEach(function (s) { grid[s.r][s.c] = s.v; });
      snap.specials.forEach(function (s) { grid[s.r][s.c] = s.v; });
      snap.skulls.forEach(function (s) { grid[s.r][s.c] = s.v; }); // 还原旧 ☠
      captures[P] -= snap.stones.length;
      bags[P][KILL_KEY] -= snap.stones.length;
      scores[P] -= KILL_SCORE * snap.stones.length;
      if (placedSpecial) {
        bags[P][placedSpecial.e] -= 1;
        scores[P] -= SPECIALS[placedSpecial.e].score;
      }
      snap.specials.forEach(function (s) {
        bags[P][s.v.e] -= 1;
        scores[P] -= SPECIALS[s.v.e].score;
      });
      updateHud();
      fireTurnHooks();   // 落子被判自杀回滚时，回合未切换；通知托管方重新选点
      return;
    }

    // 4) 回合结束：水域格上的棋子全部消失（在吃子判定之后）
    var placedSwept = sweepWater(r, c);

    // 5) 吃子结算后：被吃棋子处放置 ☠，占位至下回合吃子判定前（防争子）
    capturedCoords.forEach(function (p) {
      if (grid[p.r][p.c] === null) placeSkull(p.r, p.c);
    });

    moves += 1;
    spawnSpecials(r, c);

    // 6) 回合结束前：四周新特殊棋子已出现，若刚落下的棋子连通块气数为 0（无法存活），该棋子消失。
    //    自然消亡：不计提子、不放 ☠、不给任何方加分，格子按地形恢复。
    var newbornDied = false;
    if (grid[r][c] === P) {
      var finalGroup = getStoneGroup(r, c, P);
      if (countLiberties(finalGroup) === 0) {
        restoreCell(r, c);
        newbornDied = true;
      }
    }

    lastMove = (placedSwept || newbornDied) ? null : { r: r, c: c };
    currentPlayer = O;

    var reason = checkGameEnd();
    var endTotal = totalScores();
    if (reason) {
      gameOver = true;
      endReason = reason;
      winner = endTotal.b === endTotal.w ? null : (endTotal.b > endTotal.w ? 'b' : 'w');
    } else if (!hasPlaceablePoint()) {
      gameOver = true;
      endReason = 'full';
      winner = endTotal.b === endTotal.w ? null : (endTotal.b > endTotal.w ? 'b' : 'w');
    }
    updateHud();
    fireTurnHooks();
  }

  function spawnSpecials(r, c) {
    var now = performance.now();
    DIRS.forEach(function (d) {
      var nr = r + d[0], nc = c + d[1];
      if (inBounds(nr, nc) && grid[nr][nc] === null) {
        var emoji = drawFromPool();        // 从特殊棋子库随机抽取
        grid[nr][nc] = { e: emoji, born: now };
        revealed[nr][nc] = true;
        if (emoji === '🟦') terrain[nr][nc] = 'water';
        else if (emoji === '🟨') terrain[nr][nc] = 'desert';
      }
    });
  }

  function hasPlaceablePoint() {
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (isPlaceable(r, c)) return true;
    return false;
  }

  // ---------- 坐标换算 ----------
  function pointerToCell(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var x = (clientX - rect.left) * (viewSize / rect.width);
    var y = (clientY - rect.top) * (viewSize / rect.height);
    var c = Math.floor(x / cell);
    var r = Math.floor(y / cell);
    if (!inBounds(r, c)) return null;
    return { r: r, c: c };
  }

  // ---------- 绘制 ----------
  function cellCenter(r, c) { return { x: (c + 0.5) * cell, y: (r + 0.5) * cell }; }

  function drawBoard() {
    ctx.fillStyle = '#26292e';
    ctx.fillRect(0, 0, viewSize, viewSize);

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (revealed[r][c]) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#cdc5b2' : '#c2b9a5';
        } else {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#84898f' : '#777c83';
        }
        ctx.fillRect(c * cell, r * cell, cell, cell);

        // 格子底色：水域恒蓝、沙漠恒浅黄（永久地形，覆盖棋子颜色）；黑子格深褐；红子格橘黄；其余特殊棋子(非⛰)浅绿
        var v = grid[r][c];
        if (terrain[r][c] === 'water') {
          ctx.fillStyle = BLUE_CELL;
          ctx.fillRect(c * cell, r * cell, cell, cell);
        } else if (terrain[r][c] === 'desert') {
          ctx.fillStyle = YELLOW_CELL;
          ctx.fillRect(c * cell, r * cell, cell, cell);
        } else if (v === 'b') {
          ctx.fillStyle = BLACK_CELL;
          ctx.fillRect(c * cell, r * cell, cell, cell);
        } else if (v === 'w') {
          ctx.fillStyle = RED_CELL;
          ctx.fillRect(c * cell, r * cell, cell, cell);
        } else if (v && v.e && v.e !== '⛰') {
          ctx.fillStyle = GREEN_CELL;
          ctx.fillRect(c * cell, r * cell, cell, cell);
        }
      }
    }

    ctx.strokeStyle = 'rgba(35, 38, 43, 0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i <= SIZE; i++) {
      var p = i * cell;
      ctx.moveTo(0, p); ctx.lineTo(viewSize, p);
      ctx.moveTo(p, 0); ctx.lineTo(p, viewSize);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(20, 22, 26, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, viewSize - 2, viewSize - 2);
  }

  function drawStone(x, y, radius, player, alpha) {
    // 黑方 🧛 / 红方 💂‍♂️（emoji 棋子）
    var emoji = player === 'b' ? '🧛' : '💂‍♂️';
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.font = 'normal ' + Math.round(radius * 2.05) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = radius * 0.25;
    ctx.shadowOffsetY = radius * 0.1;
    ctx.fillText(emoji, x, y + radius * 0.05);
    ctx.restore();
  }

  function roundRect(x, y, w, h, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function drawSpecial(r, c, emoji, born, now) {
    if (emoji === '🟦' || emoji === '🟩' || emoji === '🟨') return; // 纯颜色格，不绘 emoji
    var pt = cellCenter(r, c);
    var t = born ? Math.min(1, (now - born) / POP_DURATION) : 1;
    var scale = t >= 1 ? 1 : Math.max(0.01, easeOutBack(t));
    var tileSide = cell * 0.86 * scale;

    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.globalAlpha = SPECIAL_ALPHA;

    var tileGrad = ctx.createLinearGradient(0, -tileSide / 2, 0, tileSide / 2);
    tileGrad.addColorStop(0, 'rgba(255, 250, 235, 0.9)');
    tileGrad.addColorStop(1, 'rgba(226, 210, 172, 0.9)');
    ctx.fillStyle = tileGrad;
    roundRect(-tileSide / 2, -tileSide / 2, tileSide, tileSide, tileSide * 0.22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 64, 72, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'normal ' + Math.round(cell * 0.56 * scale) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 0, cell * 0.03);
    ctx.restore();
  }

  // ☠ 被吃标记：不透明骷髅，带弹出动画与暗红描边
  function drawSkull(r, c, born, now) {
    var pt = cellCenter(r, c);
    var t = born ? Math.min(1, (now - born) / POP_DURATION) : 1;
    var scale = t >= 1 ? 1 : Math.max(0.01, easeOutBack(t));

    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.strokeStyle = 'rgba(150, 20, 20, 0.85)';
    ctx.lineWidth = Math.max(1.5, cell * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.42 * scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = 'normal ' + Math.round(cell * 0.62 * scale) + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = cell * 0.12;
    ctx.fillText('☠', 0, cell * 0.02);
    ctx.restore();
  }

  function drawHover() {
    if (gameOver || !hover || !isPlaceable(hover.r, hover.c)) return;
    var v = grid[hover.r][hover.c];
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(hover.c * cell, hover.r * cell, cell, cell);
    ctx.restore();

    var pt = cellCenter(hover.r, hover.c);
    drawStone(pt.x, pt.y, cell * 0.4, currentPlayer, 0.45);
    if (v && v.e) {
      ctx.save();
      ctx.strokeStyle = 'rgba(210, 60, 40, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, cell * 0.46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawLastMoveMarker() {
    if (!lastMove) return;
    var pt = cellCenter(lastMove.r, lastMove.c);
    ctx.save();
    ctx.strokeStyle = 'rgba(238, 237, 241, 0.95)';
    ctx.lineWidth = Math.max(2, cell * 0.07);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, cell * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function render(now) {
    ctx.clearRect(0, 0, viewSize, viewSize);
    drawBoard();

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = grid[r][c];
        if (v && typeof v === 'object' && v.e && !v.skull) drawSpecial(r, c, v.e, v.born, now);
      }
    }
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        v = grid[r][c];
        if (v === 'b' || v === 'w') {
          var pt = cellCenter(r, c);
          drawStone(pt.x, pt.y, cell * 0.4, v);
        }
      }
    }
    for (r = 0; r < SIZE; r++) {
      for (c = 0; c < SIZE; c++) {
        v = grid[r][c];
        if (v && v.skull) drawSkull(r, c, v.born, now);
      }
    }

    drawHover();
    drawLastMoveMarker();
  }

  function loop(now) {
    if (viewSize > 0) render(now);
    requestAnimationFrame(loop);
  }

  // ---------- 事件 ----------
  canvas.addEventListener('pointermove', function (e) {
    hover = pointerToCell(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', function () { hover = null; });

  var lastPlaceAt = 0;
  function tryPlace(clientX, clientY) {
    var now = performance.now();
    if (now - lastPlaceAt < 500) return;
    var pos = pointerToCell(clientX, clientY);
    if (!pos) return;
    // 人类点击入口：当前方处于 AI 托管时禁止代下（AI 自身经 GameAPI.placeAt 落子，不受此限）
    if (window.AIControl && typeof window.AIControl.isManaged === 'function' &&
        window.AIControl.isManaged(currentPlayer)) {
      lastPlaceAt = now;   // 同样计入节流，避免 pointerdown/click 双事件重复提示
      try {
        window.dispatchEvent(new CustomEvent('ai-blocked', { detail: { player: currentPlayer } }));
      } catch (e) {}
      return;
    }
    lastPlaceAt = now;
    placeStone(pos.r, pos.c);
  }

  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); tryPlace(e.clientX, e.clientY); });
  canvas.addEventListener('click', function (e) { tryPlace(e.clientX, e.clientY); });

  resetBtn.addEventListener('click', resetGame);
  resultResetBtn.addEventListener('click', resetGame);

  window.addEventListener('resize', resizeCanvas);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resizeCanvas).observe(canvas);

  // ---------- 启动 ----------
  buildLegend();
  resetGame();
  resizeCanvas();
  requestAnimationFrame(loop);

  // ---------- 对外 API（供 ai.js 托管） ----------
  window.GameAPI = {
    SIZE: SIZE,
    DIRS: DIRS,
    SPECIALS: SPECIALS,
    KILL_SCORE: KILL_SCORE,
    get currentPlayer() { return currentPlayer; },
    get gameOver() { return gameOver; },
    get moves() { return moves; },
    getScores: function () { return { b: scores.b, w: scores.w }; },
    getShareBonus: function () { var bn = shareBonus(); return { b: bn.b, w: bn.w }; },
    getTotalScores: function () { var t = totalScores(); return { b: t.b, w: t.w }; },
    getGrid: function () { return grid; },
    isPlaceable: isPlaceable,
    previewMove: previewMove,
    placeAt: function (r, c) { placeStone(r, c); },
    onTurn: function (cb) { turnHooks.push(cb); }
  };
})();
