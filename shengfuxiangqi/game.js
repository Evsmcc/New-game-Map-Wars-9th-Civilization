class ChessGame {
    constructor() {
        this.board = Array(10).fill().map(() => Array(9).fill(null));
        this.currentPlayer = 'black';
        this.selectedPiece = null;
        this.validMoves = [];
        this.turnCount = 1;
        this.computerEnabled = false;
        this.initializeBoard();
        this.renderBoard();
        this.bindEvents();
        this.updateGameInfo();
    }

    initializeBoard() {
        // 初始化白方棋子
        this.board[0][0] = { type: 'rook', color: 'white' };
        this.board[0][1] = { type: 'knight', color: 'white' };
        this.board[0][2] = { type: 'cannon', color: 'white' };        
        this.board[0][3] = { type: 'bishop', color: 'white' };
        this.board[0][4] = { type: 'king', color: 'white' };
        this.board[0][5] = { type: 'bishop', color: 'white' };
        this.board[0][6] = { type: 'cannon', color: 'white' };
        this.board[0][7] = { type: 'knight', color: 'white' };
        this.board[0][8] = { type: 'rook', color: 'white' };
        this.board[1][4] = { type: 'queen', color: 'white' };
        this.board[2][4] = { type: 'bishop', color: 'white' };
        

        // 白方兵
        for (let i = 0; i < 9; i++) {
            this.board[3][i] = { type: 'pawn', color: 'white' };
        }

        // 黑方棋子
        this.board[9][0] = { type: 'rook', color: 'black' };
        this.board[9][1] = { type: 'knight', color: 'black' };
        this.board[9][2] = { type: 'cannon', color: 'black' };        
        this.board[9][3] = { type: 'bishop', color: 'black' };
        this.board[9][4] = { type: 'king', color: 'black' };
        this.board[9][5] = { type: 'bishop', color: 'black' };
        this.board[9][6] = { type: 'cannon', color: 'black' };
        this.board[9][7] = { type: 'knight', color: 'black' };
        this.board[9][8] = { type: 'rook', color: 'black' };
        this.board[8][4] = { type: 'queen', color: 'black' };
        this.board[7][4] = { type: 'bishop', color: 'black' };

        // 黑方兵
        for (let i = 0; i < 9; i++) {
            this.board[6][i] = { type: 'pawn', color: 'black' };
        }
    }

    renderBoard() {
        const boardElement = document.getElementById('board');
        boardElement.innerHTML = '';

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                cell.className = `cell ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
                cell.dataset.row = row;
                cell.dataset.col = col;

                // 高亮选中的棋子
                if (this.selectedPiece && this.selectedPiece.row === row && this.selectedPiece.col === col) {
                    cell.classList.add('selected');
                }

                // 高亮可行走的位置
                if (this.validMoves.some(([r, c]) => r === row && c === col)) {
                    if (this.board[row][col]) {
                        // 吃子位置
                        cell.classList.add('valid-move', 'capture');
                    } else {
                        // 普通移动位置
                        cell.classList.add('valid-move');
                    }
                }

                if (this.board[row][col]) {
                    const piece = document.createElement('div');
                    piece.className = `piece ${this.board[row][col].color}`;
                    piece.textContent = this.getPieceSymbol(this.board[row][col].type);
                    cell.appendChild(piece);
                }

                boardElement.appendChild(cell);
            }
        }
    }

    getPieceSymbol(type) {
        const symbols = {
            king: '王',
            queen: '后',
            rook: '车',
            bishop: '象',
            knight: '马',
            pawn: '兵',
            cannon: '炮',
            emperor: '皇'
        };
        return symbols[type] || '';
    }

    bindEvents() {
        const boardElement = document.getElementById('board');
        boardElement.addEventListener('click', (e) => {
            const cell = e.target.closest('.cell');
            if (cell) {
                const row = parseInt(cell.dataset.row);
                const col = parseInt(cell.dataset.col);
                this.handleCellClick(row, col);
            }
        });

        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetGame();
        });

        // 添加电脑托管复选框的事件监听
        const computerCheck = document.getElementById('computer-check');
        computerCheck.addEventListener('change', (e) => {
            this.computerEnabled = e.target.checked;
            // 如果启用电脑托管且当前是白方回合，立即执行电脑走棋
            if (this.computerEnabled && this.currentPlayer === 'white') {
                setTimeout(() => this.computerMove(), 500);
            }
        });
    }

    handleCellClick(row, col) {
        // 如果电脑托管启用且当前是白方回合，不允许手动点击
        if (this.computerEnabled && this.currentPlayer === 'white') {
            return;
        }
        
        if (this.selectedPiece) {
            if (this.isValidMove(row, col)) {
                this.makeMove(row, col);
                this.selectedPiece = null;
                this.validMoves = [];
                this.switchPlayer();
            } else {
                this.selectedPiece = null;
                this.validMoves = [];
                if (this.board[row][col] && this.board[row][col].color === this.currentPlayer) {
                    this.selectedPiece = { row, col };
                    this.validMoves = this.getValidMoves(row, col);
                }
            }
        } else {
            if (this.board[row][col] && this.board[row][col].color === this.currentPlayer) {
                this.selectedPiece = { row, col };
                this.validMoves = this.getValidMoves(row, col);
            }
        }
        this.renderBoard();
    }

    getValidMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];

        const moves = [];

        switch (piece.type) {
            case 'pawn':
                moves.push(...this.getPawnMoves(row, col, piece.color));
                break;
            case 'rook':
                moves.push(...this.getRookMoves(row, col));
                break;
            case 'knight':
                moves.push(...this.getKnightMoves(row, col));
                break;
            case 'bishop':
                moves.push(...this.getBishopMoves(row, col));
                break;
            case 'queen':
                moves.push(...this.getQueenMoves(row, col));
                break;
            case 'king':
                moves.push(...this.getKingMoves(row, col));
                break;
            case 'cannon':
                moves.push(...this.getCannonMoves(row, col));
                break;
            case 'emperor':
                moves.push(...this.getEmperorMoves(row, col));
                break;
        }

        return moves.filter(([r, c]) => {
            return r >= 0 && r < 10 && c >= 0 && c < 9 && 
                   (!this.board[r][c] || this.board[r][c].color !== piece.color);
        });
    }

    getPawnMoves(row, col, color) {
        const moves = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // 横或竖都可以走

        // 横或竖走一格
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 9) {
                if (!this.board[newRow][newCol]) {
                    moves.push([newRow, newCol]);
                }
            }
        }

        // 斜进一格吃敌子
        const diagonalDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of diagonalDirections) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 9) {
                if (this.board[newRow][newCol] && this.board[newRow][newCol].color !== color) {
                    moves.push([newRow, newCol]);
                }
            }
        }

        return moves;
    }

    getRookMoves(row, col) {
        const moves = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            let hasEncounteredEnemy = false;
            while (r >= 0 && r < 10 && c >= 0 && c < 9) {
                if (!this.board[r][c]) {
                    // 如果遇到空格，且之前已经遇到过敌方棋子，则不能继续移动
                    if (hasEncounteredEnemy) {
                        break;
                    }
                    moves.push([r, c]);
                } else {
                    if (this.board[r][c].color !== this.board[row][col].color) {
                        hasEncounteredEnemy = true;
                        moves.push([r, c]);
                        // 遇到敌方棋子后，如果后面还是敌方棋子，可以继续移动
                        r += dr;
                        c += dc;
                        continue;
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }

        return moves;
    }

    getKnightMoves(row, col) {
        const moves = [];
        // 先横或竖走一格，再斜走一格
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // 横或竖
        const diagonalDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // 斜走

        for (const [dr1, dc1] of directions) {
            const intermediateRow = row + dr1;
            const intermediateCol = col + dc1;
            // 中间位置不需要为空，可以越子
            for (const [dr2, dc2] of diagonalDirections) {
                const newRow = intermediateRow + dr2;
                const newCol = intermediateCol + dc2;
                if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 9) {
                    if (!this.board[newRow][newCol] || this.board[newRow][newCol].color !== this.board[row][col].color) {
                        moves.push([newRow, newCol]);
                    }
                }
            }
        }

        return moves;
    }

    getBishopMoves(row, col) {
        const moves = [];
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            let hasEncounteredEnemy = false;
            while (r >= 0 && r < 10 && c >= 0 && c < 9) {
                if (!this.board[r][c]) {
                    // 如果遇到空格，且之前已经遇到过敌方棋子，则不能继续移动
                    if (hasEncounteredEnemy) {
                        break;
                    }
                    moves.push([r, c]);
                } else {
                    if (this.board[r][c].color !== this.board[row][col].color) {
                        hasEncounteredEnemy = true;
                        moves.push([r, c]);
                        // 遇到敌方棋子后，如果后面还是敌方棋子，可以继续移动
                        r += dr;
                        c += dc;
                        continue;
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }

        return moves;
    }

    getQueenMoves(row, col) {
        const moves = [];
        // 横或竖
        const straightDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        // 斜走
        const diagonalDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        const allDirections = [...straightDirections, ...diagonalDirections];

        for (const [dr, dc] of allDirections) {
            let r = row + dr;
            let c = col + dc;
            let hasEncounteredEnemy = false;
            while (r >= 0 && r < 10 && c >= 0 && c < 9) {
                if (!this.board[r][c]) {
                    // 如果遇到空格，且之前已经遇到过敌方棋子，则不能继续移动
                    if (hasEncounteredEnemy) {
                        break;
                    }
                    moves.push([r, c]);
                } else {
                    if (this.board[r][c].color !== this.board[row][col].color) {
                        hasEncounteredEnemy = true;
                        moves.push([r, c]);
                        // 遇到敌方棋子后，如果后面还是敌方棋子，可以继续移动
                        r += dr;
                        c += dc;
                        continue;
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }

        return moves;
    }

    getKingMoves(row, col) {
        const moves = [];
        const kingMoves = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

        for (const [dr, dc] of kingMoves) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 9) {
                if (!this.board[newRow][newCol] || this.board[newRow][newCol].color !== this.board[row][col].color) {
                    moves.push([newRow, newCol]);
                }
            }
        }

        return moves;
    }

    getCannonMoves(row, col) {
        const moves = [];
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        for (const [dr, dc] of directions) {
            let r = row + dr;
            let c = col + dc;
            let pieceCount = 0;
            while (r >= 0 && r < 10 && c >= 0 && c < 9) {
                if (!this.board[r][c]) {
                    // 空位置，只有当没有跳过棋子时才能走
                    if (pieceCount === 0) {
                        moves.push([r, c]);
                    }
                } else {
                    pieceCount++;
                    // 吃子：必须跳过一个棋子
                    if (pieceCount === 2 && this.board[r][c].color !== this.board[row][col].color) {
                        moves.push([r, c]);
                        break;
                    } else if (pieceCount > 2) {
                        break;
                    }
                }
                r += dr;
                c += dc;
            }
        }

        return moves;
    }

    getEmperorMoves(row, col) {
        const moves = [];
        // 横或竖
        const straightDirections = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        // 斜走
        const diagonalDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        const allDirections = [...straightDirections, ...diagonalDirections];

        // 像后一样走
        for (const [dr, dc] of allDirections) {
            let r = row + dr;
            let c = col + dc;
            let hasEncounteredEnemy = false;
            while (r >= 0 && r < 10 && c >= 0 && c < 9) {
                if (!this.board[r][c]) {
                    // 如果遇到空格，且之前已经遇到过敌方棋子，则不能继续移动
                    if (hasEncounteredEnemy) {
                        break;
                    }
                    moves.push([r, c]);
                } else {
                    if (this.board[r][c].color !== this.board[row][col].color) {
                        hasEncounteredEnemy = true;
                        moves.push([r, c]);
                        // 遇到敌方棋子后，如果后面还是敌方棋子，可以继续移动
                        r += dr;
                        c += dc;
                        continue;
                    }
                    break;
                }
                r += dr;
                c += dc;
            }
        }

        // 像马一样走
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // 横或竖
        const diagonalDirections2 = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // 斜走

        for (const [dr1, dc1] of directions) {
            const intermediateRow = row + dr1;
            const intermediateCol = col + dc1;
            // 中间位置不需要为空，可以越子
            for (const [dr2, dc2] of diagonalDirections2) {
                const newRow = intermediateRow + dr2;
                const newCol = intermediateCol + dc2;
                if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 9) {
                    if (!this.board[newRow][newCol] || this.board[newRow][newCol].color !== this.board[row][col].color) {
                        moves.push([newRow, newCol]);
                    }
                }
            }
        }

        return moves;
    }

    isValidMove(row, col) {
        return this.validMoves.some(([r, c]) => r === row && c === col);
    }

    makeMove(row, col) {
        if (this.selectedPiece) {
            const { row: fromRow, col: fromCol } = this.selectedPiece;
            const piece = this.board[fromRow][fromCol];
            
            // 检查是否是马步移动（用于皇）
            const isKnightMove = Math.abs(row - fromRow) === 2 && Math.abs(col - fromCol) === 1 || 
                               Math.abs(row - fromRow) === 1 && Math.abs(col - fromCol) === 2;
            
            // 对于车、象、后、皇（非马步移动），需要处理路径上的敌方棋子
            if ((piece.type === 'rook' || piece.type === 'bishop' || piece.type === 'queen' || piece.type === 'emperor') && !isKnightMove) {
                const dr = Math.sign(row - fromRow);
                const dc = Math.sign(col - fromCol);
                let currentRow = fromRow + dr;
                let currentCol = fromCol + dc;
                
                // 清理路径上的敌方棋子
                while (currentRow !== row || currentCol !== col) {
                    if (this.board[currentRow][currentCol] && this.board[currentRow][currentCol].color !== piece.color) {
                        // 检查是否吃掉了王
                        if (this.board[currentRow][currentCol].type === 'king') {
                            this.gameOver(this.board[currentRow][currentCol].color);
                        }
                        this.board[currentRow][currentCol] = null;
                    }
                    currentRow += dr;
                    currentCol += dc;
                }
            }
            
            // 检查目标位置是否有敌方王
            if (this.board[row][col] && this.board[row][col].type === 'king' && this.board[row][col].color !== piece.color) {
                this.gameOver(this.board[row][col].color);
            }
            
            // 移动棋子到目标位置
            this.board[row][col] = piece;
            this.board[fromRow][fromCol] = null;
            
            // 检查是否可以升变为皇
            this.checkForEmperorPromotion(row, col, piece);
        }
    }
    
    gameOver(loserColor) {
        const winnerColor = loserColor === 'white' ? 'black' : 'white';
        alert(`${winnerColor === 'white' ? '白' : '黑'}方获胜！游戏结束。`);
        // 禁用所有点击事件
        this.computerEnabled = false;
        document.getElementById('computer-check').disabled = true;
    }
    
    checkForEmperorPromotion(row, col, piece) {
        // 检查是否在对方的底线或次底线
        const isAtOpponentBottom = (piece.color === 'white' && (row === 8 || row === 9)) || 
                                  (piece.color === 'black' && (row === 0 || row === 1));
        
        if (isAtOpponentBottom) {
            // 检查己方是否存在兵和马
            const hasPawnOrKnight = this.hasPieceOfType(piece.color, 'pawn') || this.hasPieceOfType(piece.color, 'knight');
            
            // 当己方存在兵和马时，只有兵和马可以升变成皇
            // 当己方不存在兵和马时，其它己方棋子才可以升变为皇
            const canPromote = hasPawnOrKnight ? (piece.type === 'pawn' || piece.type === 'knight') : true;
            
            if (canPromote) {
                // 找到自己的王
                const kingPosition = this.findKing(piece.color);
                if (kingPosition) {
                    // 检查是否与王照面（同一行、列或斜线，且中间无棋子）
                    if (this.isInLineWithKing(row, col, kingPosition.row, kingPosition.col)) {
                        // 升变为皇
                        piece.type = 'emperor';
                    }
                }
            }
        }
    }
    
    hasPieceOfType(color, type) {
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = this.board[row][col];
                if (piece && piece.type === type && piece.color === color) {
                    return true;
                }
            }
        }
        return false;
    }
    
    findKing(color) {
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = this.board[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return { row, col };
                }
            }
        }
        return null;
    }
    
    isInLineWithKing(row1, col1, row2, col2) {
        // 检查是否在同一行
        if (row1 === row2) {
            const minCol = Math.min(col1, col2);
            const maxCol = Math.max(col1, col2);
            for (let col = minCol + 1; col < maxCol; col++) {
                if (this.board[row1][col]) {
                    return false;
                }
            }
            return true;
        }
        
        // 检查是否在同一列
        if (col1 === col2) {
            const minRow = Math.min(row1, row2);
            const maxRow = Math.max(row1, row2);
            for (let row = minRow + 1; row < maxRow; row++) {
                if (this.board[row][col1]) {
                    return false;
                }
            }
            return true;
        }
        
        // 检查是否在同一斜线
        if (Math.abs(row1 - row2) === Math.abs(col1 - col2)) {
            const dr = Math.sign(row2 - row1);
            const dc = Math.sign(col2 - col1);
            let currentRow = row1 + dr;
            let currentCol = col1 + dc;
            
            while (currentRow !== row2 && currentCol !== col2) {
                if (this.board[currentRow][currentCol]) {
                    return false;
                }
                currentRow += dr;
                currentCol += dc;
            }
            return true;
        }
        
        return false;
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        if (this.currentPlayer === 'black') {
            this.turnCount++;
        }
        this.updateGameInfo();
        
        // 检查是否需要电脑自动走棋
        if (this.currentPlayer === 'white' && this.computerEnabled) {
            setTimeout(() => this.computerMove(), 500);
        }
    }

    updateStatus() {
        // 移除了状态显示，因为行动方信息已经在左侧栏显示
    }
    
    updateGameInfo() {
        const currentPlayerElement = document.getElementById('current-player');
        currentPlayerElement.textContent = this.currentPlayer === 'white' ? '白方' : '黑方';
        
        const turnCountElement = document.getElementById('turn-count');
        turnCountElement.textContent = this.turnCount;
    }

    resetGame() {
        this.board = Array(10).fill().map(() => Array(9).fill(null));
        this.currentPlayer = 'black';
        this.selectedPiece = null;
        this.validMoves = [];
        this.turnCount = 1;
        this.initializeBoard();
        this.renderBoard();
        this.updateGameInfo();
    }
    
    computerMove() {
        // 使用极大极小搜索算法选择最佳走法
        const bestMove = this.minimax(3, true, -Infinity, Infinity);
        
        if (bestMove) {
            this.selectedPiece = bestMove.from;
            this.makeMove(bestMove.to.row, bestMove.to.col);
            this.selectedPiece = null;
            this.validMoves = [];
            this.renderBoard();
            this.switchPlayer();
        }
    }
    
    minimax(depth, isMaximizing, alpha, beta) {
        // 检查游戏是否结束
        if (depth === 0) {
            return this.evaluateBoard();
        }
        
        if (isMaximizing) {
            let maxScore = -Infinity;
            let bestMove = null;
            
            // 找到所有白棋的可行走法
            const possibleMoves = [];
            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 9; col++) {
                    const piece = this.board[row][col];
                    if (piece && piece.color === 'white') {
                        const moves = this.getValidMoves(row, col);
                        for (const move of moves) {
                            possibleMoves.push({ from: { row, col }, to: { row: move[0], col: move[1] } });
                        }
                    }
                }
            }
            
            for (const move of possibleMoves) {
                // 保存当前状态
                const originalPiece = this.board[move.to.row][move.to.col];
                const movingPiece = this.board[move.from.row][move.from.col];
                
                // 执行移动
                this.board[move.to.row][move.to.col] = movingPiece;
                this.board[move.from.row][move.from.col] = null;
                
                // 递归搜索
                const score = this.minimax(depth - 1, false, alpha, beta);
                
                // 恢复状态
                this.board[move.from.row][move.from.col] = movingPiece;
                this.board[move.to.row][move.to.col] = originalPiece;
                
                if (score > maxScore) {
                    maxScore = score;
                    bestMove = move;
                }
                
                alpha = Math.max(alpha, score);
                if (beta <= alpha) {
                    break;
                }
            }
            
            return depth === 3 ? bestMove : maxScore;
        } else {
            let minScore = Infinity;
            
            // 找到所有黑棋的可行走法
            const possibleMoves = [];
            for (let row = 0; row < 10; row++) {
                for (let col = 0; col < 9; col++) {
                    const piece = this.board[row][col];
                    if (piece && piece.color === 'black') {
                        const moves = this.getValidMoves(row, col);
                        for (const move of moves) {
                            possibleMoves.push({ from: { row, col }, to: { row: move[0], col: move[1] } });
                        }
                    }
                }
            }
            
            for (const move of possibleMoves) {
                // 保存当前状态
                const originalPiece = this.board[move.to.row][move.to.col];
                const movingPiece = this.board[move.from.row][move.from.col];
                
                // 执行移动
                this.board[move.to.row][move.to.col] = movingPiece;
                this.board[move.from.row][move.from.col] = null;
                
                // 递归搜索
                const score = this.minimax(depth - 1, true, alpha, beta);
                
                // 恢复状态
                this.board[move.from.row][move.from.col] = movingPiece;
                this.board[move.to.row][move.to.col] = originalPiece;
                
                if (score < minScore) {
                    minScore = score;
                }
                
                beta = Math.min(beta, score);
                if (beta <= alpha) {
                    break;
                }
            }
            
            return minScore;
        }
    }
    
    evaluateBoard() {
        // 棋子价值
        const pieceValues = {
            king: 10000,
            queen: 900,
            emperor: 1500,
            rook: 500,
            bishop: 300,
            knight: 300,
            cannon: 350,
            pawn: 100
        };
        
        let score = 0;
        
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    const value = pieceValues[piece.type] || 0;
                    score += piece.color === 'white' ? value : -value;
                }
            }
        }
        
        return score;
    }
}

// 初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});
