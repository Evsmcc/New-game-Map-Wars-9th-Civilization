;(function () {
  var canvas = document.getElementById('board')
  var ctx = canvas.getContext('2d')
  var dpr = window.devicePixelRatio || 1
  var cssW = canvas.clientWidth
  var cssH = canvas.clientHeight
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  ctx.scale(dpr, dpr)
  var cols = 11
  var rows = 10
  var margin = 30
  var nodeR = 5
  var w = cssW
  var h = cssH
  var innerW = w - margin * 2
  var innerH = h - margin * 2
  var stepX = innerW / (cols - 1)
  var stepY = innerH / (rows - 1)
  var riverTopY = margin + stepY * 4
  var riverBottomY = margin + stepY * 5
  function drawBoard() {
    ctx.fillStyle = '#f0f9e8'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#eaf6ff'
    ctx.fillRect(margin, riverTopY, innerW, riverBottomY - riverTopY)
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 1
    for (var r = 0; r < rows; r++) {
      var y = margin + stepY * r
      ctx.beginPath()
      ctx.moveTo(margin, y)
      ctx.lineTo(margin + innerW, y)
      ctx.stroke()
    }
    for (var c = 0; c < cols; c++) {
      var x = margin + stepX * c
      if (c === 0 || c === cols - 1) {
        ctx.beginPath()
        ctx.moveTo(x, margin)
        ctx.lineTo(x, margin + innerH)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.moveTo(x, margin)
        ctx.lineTo(x, riverTopY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x, riverBottomY)
        ctx.lineTo(x, margin + innerH)
        ctx.stroke()
      }
    }
    ctx.fillStyle = '#111827'
    for (var rr = 0; rr < rows; rr++) {
      var yy = margin + stepY * rr
      for (var cc = 0; cc < cols; cc++) {
        var xx = margin + stepX * cc
        ctx.beginPath()
        ctx.arc(xx, yy, nodeR, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.fillStyle = '#2563eb'
    ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('河道', margin + innerW / 2, (riverTopY + riverBottomY) / 2)
  }
  var pieceR = 18
  function xy(c, r) {
    return { x: margin + stepX * c, y: margin + stepY * r }
  }
  var pieces = []
  var redText = { rook: '车', knight: '马', bishop: '相', advisor: '仕', king: '帅', jiang: '吴' , jiang2: '蜀', cannon: '炮', pawn: '兵' }
  var blackText = { rook: '車', knight: '馬', bishop: '象', advisor: '士', king: '魏', cannon: '炮', pawn: '卒' }
  function place(side, type, c, r, colorOverride) {
    var t = side === 'black' ? blackText[type] : redText[type]
    var base = side === 'red' ? '#dc2626' : '#111827'
    if("jiang2" == type){
      pieces.push({ side: side, type: "jiang", c: c, r: r, text: t, color: colorOverride || base })
    } else {
      pieces.push({ side: side, type: type, c: c, r: r, text: t, color: colorOverride || base })
    }

  }
  function seedPieces() {
    pieces = []
    place('black', 'rook', 1, 0)
    place('black', 'rook', 9, 0)
    place('black', 'knight', 2, 0)
    place('black', 'knight', 8, 0)
    place('black', 'bishop', 3, 0)
    place('black', 'bishop', 7, 0)
    place('black', 'advisor', 4, 0)
    place('black', 'advisor', 6, 0)
    place('black', 'king', 5, 0)
    place('black', 'cannon', 0, 2)
    place('black', 'cannon', 10, 2)
    place('black', 'pawn', 1, 3)
    place('black', 'pawn', 3, 3)
    place('black', 'pawn', 5, 3)
    place('black', 'pawn', 7, 3)
    place('black', 'pawn', 9, 3)
    place('red', 'rook', 3, 8)
    place('red', 'rook', 7, 8)
    place('blue', 'knight', 2, 9, '#6ec7f0ff')
    place('purple', 'knight', 8, 9, '#4c1d95')
    place('red', 'bishop', 3, 9)
    place('red', 'bishop', 7, 9)
    place('red', 'advisor', 4, 9)
    place('red', 'advisor', 6, 9)
    place('red', 'king', 5, 9)
    place('blue', 'cannon', 0, 7, '#6ec7f0ff')
    place('purple', 'cannon', 10, 7, '#4c1d95')
    place('blue', 'jiang', 1, 9, '#6ec7f0ff')
    place('purple', 'jiang2', 9, 9, '#4c1d95')
    place('red', 'pawn', 1, 6)
    place('red', 'pawn', 3, 6)
    place('red', 'pawn', 5, 6)
    place('red', 'pawn', 7, 6)
    place('red', 'pawn', 9, 6)
  }
  seedPieces()
  function drawPiece(p) {
    var pt = xy(p.c, p.r)
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, pieceR, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = p.color
    ctx.stroke()
    ctx.fillStyle = p.color
    ctx.font = 'bold 16px "Microsoft YaHei", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.text, pt.x, pt.y)
  }
  function inBounds(c, r) {
    return c >= 0 && c <= 10 && r >= 0 && r <= 9
  }
  function indexAt(c, r) {
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i]
      if (p.c === c && p.r === r) return i
    }
    return -1
  }
  function betweenCount(c1, r1, c2, r2) {
    if (c1 === c2) {
      var minr = Math.min(r1, r2)
      var maxr = Math.max(r1, r2)
      var n = 0
      for (var rr = minr + 1; rr < maxr; rr++) if (indexAt(c1, rr) !== -1) n++
      return n
    }
    if (r1 === r2) {
      var minc = Math.min(c1, c2)
      var maxc = Math.max(c1, c2)
      var m = 0
      for (var cc = minc + 1; cc < maxc; cc++) if (indexAt(cc, r1) !== -1) m++
      return m
    }
    return -1
  }
  function palace(side, c, r) {
    if (side === 'red') return c >= 4 && c <= 6 && r >= 7 && r <= 9
    return c >= 4 && c <= 6 && r >= 0 && r <= 2
  }
  function ownSide(side, r) {
    if (side === 'red') return r >= 5
    return r <= 4
  }
  function kingsFace(forPieces) {
    var rc = null
    var bc = null
    for (var i = 0; i < forPieces.length; i++) {
      var p = forPieces[i]
      if (p.type === 'king') {
        if (p.side === 'red') rc = p
        else bc = p
      }
    }
    if (!rc || !bc) return false
    if (rc.c !== bc.c) return false
    var cnt = betweenCount(rc.c, rc.r, bc.c, bc.r)
    return cnt === 0
  }
  function clonePieces() {
    var arr = []
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i]
      arr.push({ side: p.side, type: p.type, c: p.c, r: p.r, text: p.text, color: p.color })
    }
    return arr
  }
  function legalMoves(p) {
    var moves = []
    if (p.type === 'rook') {
      var dirs = [[1,0],[-1,0],[0,1],[0,-1]]
      for (var d = 0; d < dirs.length; d++) {
        var dc = dirs[d][0], dr = dirs[d][1]
        var cc = p.c + dc, rr = p.r + dr
        while (inBounds(cc, rr) && indexAt(cc, rr) === -1) {
          moves.push({c: cc, r: rr})
          cc += dc; rr += dr
        }
        if (inBounds(cc, rr) && indexAt(cc, rr) !== -1) {
          var idx = indexAt(cc, rr)
          if (pieces[idx].side !== p.side) moves.push({c: cc, r: rr})
        }
      }
    } else if (p.type === 'cannon') {
      var dirs2 = [[1,0],[-1,0],[0,1],[0,-1]]
      for (var d2 = 0; d2 < dirs2.length; d2++) {
        var dc2 = dirs2[d2][0], dr2 = dirs2[d2][1]
        var cc2 = p.c + dc2, rr2 = p.r + dr2
        while (inBounds(cc2, rr2) && indexAt(cc2, rr2) === -1) {
          moves.push({c: cc2, r: rr2})
          cc2 += dc2; rr2 += dr2
        }
        while (inBounds(cc2, rr2) && indexAt(cc2, rr2) === -1) { cc2 += dc2; rr2 += dr2 }
        if (inBounds(cc2, rr2)) {
          var cc3 = cc2 + dc2, rr3 = rr2 + dr2
          while (inBounds(cc3, rr3) && indexAt(cc3, rr3) === -1) { cc3 += dc2; rr3 += dr2 }
          if (inBounds(cc3, rr3)) {
            var idx3 = indexAt(cc3, rr3)
            if (idx3 !== -1 && pieces[idx3].side !== p.side) moves.push({c: cc3, r: rr3})
          }
        }
      }
    } else if (p.type === 'knight') {
      var ks = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]
      for (var k = 0; k < ks.length; k++) {
        var dx = ks[k][0], dy = ks[k][1]
        var legc = p.c + (Math.abs(dx) === 2 ? dx/2 : 0)
        var legr = p.r + (Math.abs(dy) === 2 ? dy/2 : 0)
        if (indexAt(legc, legr) !== -1) continue
        var nc = p.c + dx, nr = p.r + dy
        if (!inBounds(nc, nr)) continue
        var idxk = indexAt(nc, nr)
        if (idxk === -1 || pieces[idxk].side !== p.side) moves.push({c: nc, r: nr})
      }
    } else if (p.type === 'bishop') {
      var bs = [[2,2],[2,-2],[-2,2],[-2,-2]]
      for (var b = 0; b < bs.length; b++) {
        var bdx = bs[b][0], bdy = bs[b][1]
        var eyeC = p.c + bdx/2, eyeR = p.r + bdy/2
        var nc2 = p.c + bdx, nr2 = p.r + bdy
        if (!inBounds(nc2, nr2)) continue
        if (indexAt(eyeC, eyeR) !== -1) continue
        if (p.side === 'red' && nr2 <= 4) continue
        if (p.side === 'black' && nr2 >= 5) continue
        var idxb = indexAt(nc2, nr2)
        if (idxb === -1 || pieces[idxb].side !== p.side) moves.push({c: nc2, r: nr2})
      }
    } else if (p.type === 'advisor') {
      var as = [[1,1],[1,-1],[-1,1],[-1,-1]]
      for (var a = 0; a < as.length; a++) {
        var ac = p.c + as[a][0], ar = p.r + as[a][1]
        if (!inBounds(ac, ar)) continue
        if (!palace(p.side, ac, ar)) continue
        var idxa = indexAt(ac, ar)
        if (idxa === -1 || pieces[idxa].side !== p.side) moves.push({c: ac, r: ar})
      }
    } else if (p.type === 'king') {
      var gs = [[1,0],[-1,0],[0,1],[0,-1]]
      for (var g = 0; g < gs.length; g++) {
        var gc = p.c + gs[g][0], gr = p.r + gs[g][1]
        if (!inBounds(gc, gr)) continue
        var idxg = indexAt(gc, gr)
        if (idxg !== -1 && pieces[idxg].side === p.side) continue
        var cp = clonePieces()
        var idxSelf = indexAt(p.c, p.r)
        cp[idxSelf] = { side: p.side, type: p.type, c: gc, r: gr, text: p.text, color: p.color }
        if (idxg !== -1) {
          for (var rem = 0; rem < cp.length; rem++) {
            if (rem !== idxSelf && cp[rem].c === gc && cp[rem].r === gr) { cp.splice(rem,1); break }
          }
        }
        moves.push({c: gc, r: gr})
      }
    } else if (p.type === 'jiang') {
      var gs2 = [[1,0],[-1,0],[0,1],[0,-1]]
      for (var g2 = 0; g2 < gs2.length; g2++) {
        var gc2 = p.c + gs2[g2][0], gr2 = p.r + gs2[g2][1]
        if (!inBounds(gc2, gr2)) continue
        var idxg2 = indexAt(gc2, gr2)
        if (idxg2 !== -1 && pieces[idxg2].side === p.side) continue
        moves.push({c: gc2, r: gr2})
      }
      var ks2 = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]]
      for (var k2 = 0; k2 < ks2.length; k2++) {
        var dx2 = ks2[k2][0], dy2 = ks2[k2][1]
        var legc2 = p.c + (Math.abs(dx2) === 2 ? dx2/2 : 0)
        var legr2 = p.r + (Math.abs(dy2) === 2 ? dy2/2 : 0)
        if (indexAt(legc2, legr2) !== -1) continue
        var nc3 = p.c + dx2, nr3 = p.r + dy2
        if (!inBounds(nc3, nr3)) continue
        var idxj = indexAt(nc3, nr3)
        if (idxj === -1 || pieces[idxj].side !== p.side) moves.push({c: nc3, r: nr3})
      }
    } else if (p.type === 'pawn') {
      var dir = p.side === 'red' ? -1 : 1
      var fc = p.c, fr = p.r + dir
      if (inBounds(fc, fr)) {
        var idxp = indexAt(fc, fr)
        if (idxp === -1 || pieces[idxp].side !== p.side) moves.push({c: fc, r: fr})
      }
      var crossed = p.side === 'red' ? p.r <= 4 : p.r >= 5
      if (crossed) {
        var lc = p.c - 1, lr = p.r
        var rc2 = p.c + 1, rr2 = p.r
        if (inBounds(lc, lr)) {
          var il = indexAt(lc, lr)
          if (il === -1 || pieces[il].side !== p.side) moves.push({c: lc, r: lr})
        }
        if (inBounds(rc2, rr2)) {
          var ir = indexAt(rc2, rr2)
          if (ir === -1 || pieces[ir].side !== p.side) moves.push({c: rc2, r: rr2})
        }
      }
    }
    var out = []
    for (var m = 0; m < moves.length; m++) {
      var mc = moves[m].c, mr = moves[m].r
      var idxm = indexAt(mc, mr)
      if (idxm !== -1 && pieces[idxm].side === p.side) continue
      if (p.type !== 'king') {
        var cp2 = clonePieces()
        var selfIdx = indexAt(p.c, p.r)
        cp2[selfIdx] = { side: p.side, type: p.type, c: mc, r: mr, text: p.text, color: p.color }
        if (idxm !== -1) {
          for (var rem2 = 0; rem2 < cp2.length; rem2++) {
            if (rem2 !== selfIdx && cp2[rem2].c === mc && cp2[rem2].r === mr) { cp2.splice(rem2,1); break }
          }
        }
      }
      out.push({c: mc, r: mr})
    }
    return out
  }
  var selected = -1
  var movesForSelected = []
  var turnOrder = ['魏', '吴', '魏', '蜀']
  var turnIdx = 0
  var moveCount = 1
  var gameOver = false
  var resultText = '进行中'
  var autoWei = false
  var autoWu = false
  var autoShu = false
  var elTurnCount = document.getElementById('turn-count')
  var elCurrentTurn = document.getElementById('current-turn')
  var elResult = document.getElementById('result')
  var elReset = document.getElementById('btn-reset')
  var elAutoWei = document.getElementById('auto-wei')
  var elAutoWu = document.getElementById('auto-wu')
  var elAutoShu = document.getElementById('auto-shu')
  var elFactionOverlay = document.getElementById('faction-overlay')
  var elChooseWei = document.getElementById('choose-wei')
  var elChooseWu = document.getElementById('choose-wu')
  var elChooseShu = document.getElementById('choose-shu')
  if (elAutoWei) elAutoWei.addEventListener('change', function () {
    autoWei = !!elAutoWei.checked
    if (autoWei && currentActor() === '魏') setTimeout(tickAIMove, 0)
  })
  if (elAutoWu) elAutoWu.addEventListener('change', function () {
    autoWu = !!elAutoWu.checked
    if (autoWu && currentActor() === '吴') setTimeout(tickAIMove, 0)
  })
  if (elAutoShu) elAutoShu.addEventListener('change', function () {
    autoShu = !!elAutoShu.checked
    if (autoShu && currentActor() === '蜀') setTimeout(tickAIMove, 0)
  })
  function resetGame() {
    gameOver = false
    resultText = '进行中'
    moveCount = 1
    turnIdx = 0
    selected = -1
    movesForSelected = []
    seedPieces()
    render()
    openFactionModal()
  }
  if (elReset) elReset.addEventListener('click', resetGame)
  function currentActor() { return turnOrder[turnIdx] }
  function actorToSide(actor) {
    if (actor === '魏') return 'black'
    if (actor === '蜀') return 'red'
    return null
  }
  function updateInfoPanel() {
    if (elTurnCount) elTurnCount.textContent = String(moveCount)
    function actorLabel(a) {
      if (a === '魏') return '魏（黑色）'
      if (a === '吴') return '吴（红+蓝）'
      if (a === '蜀') return '蜀（红+紫）'
      return a
    }
    if (elCurrentTurn) elCurrentTurn.textContent = actorLabel(currentActor())
    if (elResult) elResult.textContent = resultText
    if (elAutoWei) elAutoWei.checked = autoWei
    if (elAutoWu) elAutoWu.checked = autoWu
    if (elAutoShu) elAutoShu.checked = autoShu
  }
  function setFactionAndAutos(actor) {
    if (actor === '魏') {
      autoWei = false; autoWu = true; autoShu = true
    } else if (actor === '吴') {
      autoWei = true; autoWu = false; autoShu = true
    } else if (actor === '蜀') {
      autoWei = true; autoWu = true; autoShu = false
    }
    updateInfoPanel()
    if (currentActor() === actorAutoEnabled(currentActor()) ? currentActor() : null) {}
    setTimeout(tickAIMove, 0)
  }
  function openFactionModal() {
    if (!elFactionOverlay) return
    elFactionOverlay.style.display = 'flex'
  }
  function closeFactionModal() {
    if (!elFactionOverlay) return
    elFactionOverlay.style.display = 'none'
  }
  if (elChooseWei) elChooseWei.addEventListener('click', function () { setFactionAndAutos('魏'); closeFactionModal() })
  if (elChooseWu) elChooseWu.addEventListener('click', function () { setFactionAndAutos('吴'); closeFactionModal() })
  if (elChooseShu) elChooseShu.addEventListener('click', function () { setFactionAndAutos('蜀'); closeFactionModal() })
  function hasRedKing() {
    for (var i = 0; i < pieces.length; i++) if (pieces[i].type === 'king' && pieces[i].side === 'red') return true
    return false
  }
  function hasBlackKing() {
    for (var i = 0; i < pieces.length; i++) if (pieces[i].type === 'king' && pieces[i].side === 'black') return true
    return false
  }
  function isBluePiece(p) { return p.color === '#6ec7f0ff' }
  function isPurplePiece(p) { return p.color === '#4c1d95' }
  function canActorControl(actor, p) {
    if (actor === '魏') return p.side === 'black'
    if (actor === '吴') return p.side === 'red' || (isBluePiece(p))
    if (actor === '蜀') return p.side === 'red' || (isPurplePiece(p))
    return false
  }
  function actorAutoEnabled(actor) {
    if (actor === '魏') return !!autoWei
    if (actor === '吴') return !!autoWu
    if (actor === '蜀') return !!autoShu
    return false
  }
  function isAllied(a, b) {
    if (a === b) return true
    if ((a === '吴' && b === '蜀') || (a === '蜀' && b === '吴')) return true
    return false
  }
  function pieceScore(p) {
    if (p.type === 'king') return 10000
    if (p.type === 'jiang') return 3000
    if (p.type === 'rook') return 500
    if (p.type === 'cannon') return 450
    if (p.type === 'knight') return 300
    if (p.type === 'bishop') return 250
    if (p.type === 'advisor') return 250
    if (p.type === 'pawn') return 100
    return 0
  }
  function evaluateWei(state) {
    var black = 0
    var other = 0
    for (var i = 0; i < state.length; i++) {
      var p = state[i]
      var v = pieceScore(p)
      if (p.side === 'black') black += v
      else other += v
    }
    return black - other
  }
  function evaluateWuShu(state) {
    var nonBlack = 0
    var black = 0
    for (var i = 0; i < state.length; i++) {
      var p = state[i]
      var v = pieceScore(p)
      if (p.side === 'black') black += v
      else nonBlack += v
    }
    return nonBlack - black
  }
  function legalMovesForState(state, idx) {
    var old = pieces
    pieces = state
    var mv = legalMoves(state[idx])
    pieces = old
    return mv
  }
  function allMovesForActor(state, actor) {
    var moves = []
    for (var i = 0; i < state.length; i++) {
      var p = state[i]
      if (!canActorControl(actor, p)) continue
      var mvs = legalMovesForState(state, i)
      for (var k = 0; k < mvs.length; k++) {
        moves.push({ i: i, c: mvs[k].c, r: mvs[k].r })
      }
    }
    return moves
  }
  function applyMoveState(state, move) {
    var cp = []
    for (var i = 0; i < state.length; i++) {
      var q = state[i]
      cp.push({ side: q.side, type: q.type, c: q.c, r: q.r, text: q.text, color: q.color })
    }
    var m = { i: move.i, c: move.c, r: move.r }
    var mover = cp[m.i]
    var capIdx = -1
    for (var j = 0; j < cp.length; j++) {
      if (j !== m.i && cp[j].c === m.c && cp[j].r === m.r) { capIdx = j; break }
    }
    var captured = null
    if (capIdx !== -1) { captured = cp[capIdx]; cp.splice(capIdx,1); if (capIdx < m.i) m.i -= 1; }
    mover = cp[m.i]
    mover.c = m.c
    mover.r = m.r
    if (captured && captured.type === 'jiang') {
      var rc = []
      for (var t = 0; t < cp.length; t++) {
        if (cp[t].color !== captured.color) rc.push(cp[t])
      }
      cp = rc
    }
    return cp
  }
  function minimax(state, depth, actorIdx, originActor) {
    if (depth === 0) return { score: originActor === '魏' ? evaluateWei(state) : evaluateWuShu(state) }
    var actor = turnOrder[actorIdx]
    var moves = allMovesForActor(state, actor)
    // console.log("m00:" + JSON.stringify(moves))
    if (moves.length === 0) return { score: originActor === '魏' ? evaluateWei(state) : evaluateWuShu(state) }
    var bestMove = null
    var bestScore = isAllied(originActor, actor) ? -Infinity : Infinity
    for (var m = 0; m < moves.length; m++) {
      var ns = applyMoveState(state, moves[m])
      var nextIdx = (actorIdx + 1) % turnOrder.length
      var res = minimax(ns, depth - 1, nextIdx, originActor)
      var sc = res.score
      // console.log("m:" + JSON.stringify(moves[m]))
      // console.log("Score:" + sc)
      if (isAllied(originActor, actor)) {
        if (sc > bestScore) { bestScore = sc; bestMove = moves[m] }
      } else {
        if (sc < bestScore) { bestScore = sc; bestMove = moves[m] }
      }
    }
    return { score: bestScore, move: bestMove }
  }
  function tickAIMove() {
    if (gameOver) return
    var actor = currentActor()
    if (!actorAutoEnabled(actor)) { setTimeout(tickAIMove, 1000); return }
    var all = []
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i]
      if (!canActorControl(actor, p)) continue
      var mvs = legalMoves(p)
      for (var k = 0; k < mvs.length; k++) {
        all.push({ i: i, c: mvs[k].c, r: mvs[k].r })
      }
    }
    var state = clonePieces()
    var startIdx = turnIdx
    var res = minimax(state, 3, startIdx, actor)
    // console.log("bestMove" + JSON.stringify(res))
    // console.log("all:"+ JSON.stringify(all))
    var mv = res.move
    if (!mv && all.length > 0) {
      mv = all[0]
    }
    if (!mv) {
      moveCount += 1
      turnIdx = (turnIdx + 1) % turnOrder.length
      render()
      setTimeout(tickAIMove, 1000)
      return
    }
    var mover = pieces[mv.i]
    var cap = indexAt(mv.c, mv.r)
    var capturedPiece = null
    if (cap !== -1 && cap !== mv.i) {
      capturedPiece = pieces[cap]
      pieces.splice(cap,1)
      if (cap < mv.i) mv.i -= 1
    }
    mover.c = mv.c
    mover.r = mv.r
    if (capturedPiece && capturedPiece.type === 'jiang') {
      var removeColor = capturedPiece.color
      var kept = []
      for (var qi = 0; qi < pieces.length; qi++) {
        if (pieces[qi].color !== removeColor) kept.push(pieces[qi])
      }
      pieces = kept
    }
    if (!hasBlackKing()) {
      gameOver = true
      resultText = '黑方失败'
      setTimeout(function(){ alert(resultText) }, 0)
    } else if (!hasRedKing()) {
      gameOver = true
      resultText = '红方失败'
      setTimeout(function(){ alert(resultText) }, 0)
    }
    selected = -1
    movesForSelected = []
    if (!gameOver) {
      moveCount += 1
      turnIdx = (turnIdx + 1) % turnOrder.length
    }
    render()
    if (!gameOver) setTimeout(tickAIMove, 1000)
  }
  function render() {
    drawBoard()
    updateInfoPanel()
    for (var j = 0; j < pieces.length; j++) drawPiece(pieces[j])
    for (var i = 0; i < movesForSelected.length; i++) {
      var m = movesForSelected[i]
      var mp = xy(m.c, m.r)
      var tgtIdx = indexAt(m.c, m.r)
      if (selected !== -1 && tgtIdx !== -1 && pieces[tgtIdx].side !== pieces[selected].side) {
        ctx.beginPath()
        ctx.arc(mp.x, mp.y, pieceR + 4, 0, Math.PI * 2)
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.lineWidth = 1
      } else {
        ctx.beginPath()
        ctx.arc(mp.x, mp.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(16,185,129,0.9)'
        ctx.fill()
      }
    }
    if (selected !== -1) {
      var sp = pieces[selected]
      var pt = xy(sp.c, sp.r)
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, pieceR + 4, 0, Math.PI * 2)
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.strokeStyle = '#374151'
    }
  }
  function onClick(e) {
    if (gameOver) return
    var rect = canvas.getBoundingClientRect()
    var px = e.clientX - rect.left
    var py = e.clientY - rect.top
    var gc = Math.round((px - margin) / stepX)
    var gr = Math.round((py - margin) / stepY)
    if (gc < 0) gc = 0
    if (gc > cols - 1) gc = cols - 1
    if (gr < 0) gr = 0
    if (gr > rows - 1) gr = rows - 1
    var idx = indexAt(gc, gr)
    if (selected !== -1) {
      var can = false
      for (var k = 0; k < movesForSelected.length; k++) {
        if (movesForSelected[k].c === gc && movesForSelected[k].r === gr) { can = true; break }
      }
      if (can) {
        var sp2 = pieces[selected]
        var cap = indexAt(gc, gr)
        var capturedPiece = null
        if (cap !== -1 && cap !== selected) {
          capturedPiece = pieces[cap]
          pieces.splice(cap,1)
        }
        sp2.c = gc
        sp2.r = gr
        if (capturedPiece && capturedPiece.type === 'jiang') {
          var removeColor = capturedPiece.color
          var kept = []
          for (var qi = 0; qi < pieces.length; qi++) {
            if (pieces[qi].color !== removeColor) kept.push(pieces[qi])
          }
          pieces = kept
        }
        if (!hasBlackKing()) {
          gameOver = true
          resultText = '黑方失败'
          setTimeout(function(){ alert(resultText) }, 0)
        } else if (!hasRedKing()) {
          gameOver = true
          resultText = '红方失败'
          setTimeout(function(){ alert(resultText) }, 0)
        }
        selected = -1
        movesForSelected = []
        if (!gameOver) {
          moveCount += 1
          turnIdx = (turnIdx + 1) % turnOrder.length
        }
    render()
    setTimeout(tickAIMove, 0)
        return
      }
    }
    var actor = currentActor()
    if (idx !== -1 && canActorControl(actor, pieces[idx])) {
      selected = idx
      movesForSelected = legalMoves(pieces[idx])
    } else {
      selected = -1
      movesForSelected = []
    }
    render()
  }
  canvas.addEventListener('click', onClick)
  render()
  openFactionModal()
})()
