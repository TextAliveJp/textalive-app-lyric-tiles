import { Player, stringToDataUrl } from "textalive-app-api";

/**
 * 
 * マウスに追従して歌詞が表示されるデモ
 * 
 */
class Main
{
    constructor ()
    {
        var canMng = new CanvasManager();
        this._canMng = canMng;

        this._initPlayer();

        window.addEventListener("resize", () => this._resize());
        this._update();
    }
    // プレイヤー初期化
    _initPlayer ()
    {
        var player = new Player({
            // トークンは https://developer.textalive.jp/profile で取得したものを使う
            app: { token: "eaFarhRWbobOZTyd" },
            mediaElement: document.querySelector("#media")
        });
        
        player.addListener({
            onAppReady: (app) => this._onAppReady(app),
            onVideoReady: (v) => this._onVideoReady(v),
            onTimeUpdate: (pos) => this._onTimeUpdate(pos)
        });
        this._player = player;
    }
    // アプリ準備完了
    _onAppReady (app)
    {
        if (! app.songUrl)
        {
            // ラテルネ / その心に灯る色は
            this._player.createFromSongUrl("http://www.youtube.com/watch?v=bMtYf3R0zhY", {
                video: {
                    // 音楽地図訂正履歴: https://songle.jp/songs/2121404/history
                    beatId: 3953902,
                    repetitiveSegmentId: 2099660,
                    // 歌詞タイミング訂正履歴: https://textalive.jp/lyrics/www.youtube.com%2Fwatch%3Fv=bMtYf3R0zhY
                    lyricId: 52093,
                    lyricDiffId: 5177
                }
            });
        }

        // 画面クリックで再生／一時停止
        document.getElementById("view").addEventListener("click", () => function(p){ 
            if (p.isPlaying) p.requestPause();
            else             p.requestPlay();
        }(this._player));
    }
    // ビデオ準備完了
    _onVideoReady (v)
    {
        // 歌詞のセットアップ
        var lyrics = [];
        if (v.firstChar)
        {
            var c = v.firstChar;
            while (c)
            {
                lyrics.push(new Lyric(c));
                c = c.next;
            }
        }
        this._canMng.setLyrics(lyrics);
    }
    // 再生位置アップデート
    _onTimeUpdate (position)
    {
        this._position   = position;
        this._updateTime = Date.now();
        this._canMng.update(position);
    }

    _update ()
    {
        if (this._player.isPlaying && 0 <= this._updateTime && 0 <= this._position)
        {
            var t = (Date.now() - this._updateTime) + this._position;
            this._canMng.update(t);
        }
        window.requestAnimationFrame(() => this._update());
    }
    _resize ()
    {
        this._canMng.resize();
    }
}

class Lyric
{
    constructor (data)
    {
        this.text      = data.text;      // 歌詞文字
        this.startTime = data.startTime; // 開始タイム [ms]
        this.endTime   = data.endTime;   // 終了タイム [ms]
        this.duration  = data.duration;  // 開始から終了迄の時間 [ms]
        
        this.x = 0; // グリッドの座標 x
        this.y = 0; // グリッドの座標 y
        this.isDraw = false; // 描画するかどうか
    }
}

class CanvasManager
{
    constructor ()
    {
        // 現在のスクロール位置（画面右上基準）
        this._px = 0; this._py = 0;
        // マウス位置（中心が 0, -1 ~ 1 の範囲に正規化された値）
        this._rx = 0; this._ry = 0;

        // １グリッドの大きさ [px]
        this._space    = 160;
        // スクロール速度
        this._speed    = 1500;
        // 楽曲の再生位置
        this._position = 0;
        // マウスが画面上にあるかどうか（画面外の場合 false）
        this._isOver   = false;
        
        // キャンバス生成（描画エリア）
        this._can = document.createElement("canvas");
        this._ctx = this._can.getContext("2d");
        document.getElementById("view").append(this._can);
        
        // マウス（タッチ）イベント
        document.addEventListener("mousemove",  (e) => this._move(e));
        document.addEventListener("mouseleave", (e) => this._leave(e));
        if ("ontouchstart" in window)
        {
            // グリッドの大きさ／スクロール速度半分
            this._space *= 0.5;
            this._speed *= 0.5;
            document.addEventListener("touchmove",  (e) => this._move(e));
            document.addEventListener("touchend", (e) => this._leave(e));
        }

        this.resize();
    }

    // 歌詞の更新
    setLyrics (lyrics)
    {
        this._lyrics = lyrics;
    }
    // 再生位置アップデート
    update (position)
    {
        // マウスが画面外の時、オートモード
        if (! this._isOver)
        {
            this._rx = Math.sin(position / 1234 + 0.123) * 0.3 + 0.2;
            this._ry = Math.cos(position / 1011 + 0.111) * 0.5;
            this._mouseX = this._stw * (this._rx + 1) / 2;
            this._mouseY = this._sth * (this._ry + 1) / 2;
        }
        // マウス位置に応じてスクロール位置の更新
        var delta = (position - this._position) / 1000;
        this._px += - this._rx * delta * this._speed;
        this._py += - this._ry * delta * this._speed;

        this._drawBg();
        this._drawLyrics();

        this._position = position;
    }
    // リサイズ
    resize ()
    {
        this._can.width  = this._stw = document.documentElement.clientWidth;
        this._can.height = this._sth = document.documentElement.clientHeight;
    }
    
    // "mousemove" / "touchmove"
    _move (e)
    {
        var mx = 0;
        var my = 0;

        if (e.touches)
        {
            mx = e.touches[0].clientX;
            my = e.touches[0].clientY;
        }
        else
        {
            mx = e.clientX;
            my = e.clientY;
        }
        this._mouseX = mx;
        this._mouseY = my;

        this._rx = (mx / this._stw) * 2 - 1;
        this._ry = (my / this._sth) * 2 - 1;

        this._isOver = true;
    }
    // "mouseleave" / "touchend"
    _leave (e)
    {
        this._isOver = false;
    }

    // 背景の模様描画
    _drawBg ()
    {
        var space = this._space;

        var ox = this._px % space;
        var oy = this._py % space;

        var nx = this._stw / space + 1;
        var ny = this._sth / space + 1;

        var ctx = this._ctx;
        ctx.clearRect(0, 0, this._stw, this._sth);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (var y = 0; y <= ny; y ++)
        {
            for (var x = 0; x <= nx; x ++)
            {
                var tx = x * space + ox;
                var ty = y * space + oy;
                
                // 十字の模様描画
                ctx.moveTo(tx - 8, ty);
                ctx.lineTo(tx + 8, ty);
                ctx.moveTo(tx, ty - 8);
                ctx.lineTo(tx, ty + 8);
            }
        }
        ctx.stroke();
    }
    // 歌詞の描画
    _drawLyrics ()
    {
        if (! this._lyrics) return;
        var position = this._position;
        var space = this._space;

        var fontSize = space * 0.5;
        var ctx = this._ctx;
        ctx.textAlign = "center";
        ctx.fillStyle = "#000";

        // 全歌詞を走査
        for (var i = 0, l = this._lyrics.length; i < l; i ++)
        {
            var lyric = this._lyrics[i];
            
            if (lyric.startTime < position) // 開始タイム < 再生位置
            {
                if (position < lyric.endTime) // 再生位置 < 終了タイム
                {
                    if (! isNaN(this._mouseX) && ! lyric.isDraw)
                    {
                        // グリッド座標の計算
                        var nx = Math.floor((- this._px + this._mouseX) / space);
                        var ny = Math.floor((- this._py + this._mouseY) / space);

                        var tx = 0, ty = 0, isOk = true;

                        // 他の歌詞との衝突判定
                        hitcheck: for (var n = 0; n <= 100; n ++)
                        {
                            tx = n;
                            ty = 0;
                            var mx = -1;
                            var my =  1;
                            var rn = (n == 0) ? 1 : n * 4;

                            // 周囲を走査
                            for (var r = 0; r < rn; r ++)
                            {
                                isOk = true;
                                for (var j = 0; j < i; j ++)
                                {
                                    var tl = this._lyrics[j];
                                    
                                    // 他の歌詞と衝突している
                                    if (tl.isDraw && tl.x == nx + tx && tl.y == ny + ty)
                                    {
                                        isOk = false;
                                        break;
                                    }
                                }
                                if (isOk) break hitcheck;

                                // 次のグリッドへ
                                tx += mx; if (tx == n || tx == -n) mx = - mx;
                                ty += my; if (ty == n || ty == -n) my = - my;
                            }
                        }
                        // グリッド座標をセット＆描画を有効に
                        lyric.x = nx + tx;
                        lyric.y = ny + ty;
                        lyric.isDraw = true;
                    }
                }
                
                // 描画が有効な場合、歌詞を描画する
                if (lyric.isDraw)
                {
                    var px = lyric.x * space;
                    var py = lyric.y * space;

                    // 文字が画面外にある場合は除外
                    if (px + space < - this._px || - this._px + this._stw < px) continue;
                    if (py + space < - this._py || - this._py + this._sth < py) continue;

                    px = this._px + px + space / 2;
                    py = this._py + py + space / 2;
                    
                    var prog = this._easeOutBack(Math.min((position - lyric.startTime) / 200, 1));

                    fontSize = space * 0.5 * prog;
                    ctx.font = "bold " + fontSize + "px sans-serif";
                    ctx.fillText(lyric.text, px, py + fontSize * 0.37);
                }
            }
            else lyric.isDraw = false;
        }
    }
    _easeOutBack (x) { return 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2); }
}

new Main()