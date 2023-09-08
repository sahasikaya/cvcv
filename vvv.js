var doodle = (function() {
    Function.prototype.bind = Function.prototype.bind || function(fixThis) {
        var func = this
        return function() {
            return func.apply(fixThis, arguments)
        }
    }
    var DEBUG = false;
    var _l = function(obj) {
        DEBUG && console && console.log && console.log(obj)
    }
    var html = document.documentElement;
    var requestAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(func) {
            setTimeout(func, 17);
        };
    var
        PI_half = Math.PI / 2, resources = {};

    var Stage = function(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.objects = [];
        this.restart_timeout = 1000;
        this.paused = false;
        this.destroyed = false;
        return this;
    };

    var fps = 0, now, lastUpdate = (new Date) * 1 - 1;

    // The higher this value, the less the FPS will be affected by quick changes
    // Setting this to 1 will show you the FPS of the last sampled frame only
    var fpsFilter = 50;
    var set_fps = function() {
        var thisFrameFPS = 1000 / ((now = new Date) - lastUpdate);
        fps += (thisFrameFPS - fps) / fpsFilter;
        lastUpdate = now;
    }

    Stage.prototype.frame = function() {
        if (this.destroyed) {
            return;
        }

        //set_fps();

        //clear the stage(canvas);
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)

        //call tick on all the objects on stage
        for (var i in this.objects) {
            if (this.objects[i].destroyed == true) {
                this.objects.splice(i, 1)
            } else {
                this.objects[i].tick(this.ctx)
            }
        }

        if (this.objects.length == 0) {
            var self = this
            setTimeout(function() {
                _l("restarting in " + self.restart_timeout)
                self.setup();
                self.frame();
            }, this.restart_timeout);
        } else if (!this.paused) {
            //recursivily call itself
            requestAnimationFrame(this.frame.bind(this))
        }
    };

    Stage.prototype.setup = function() {
        this.objects.push(getRandomFormation(this));
    };

    Stage.prototype.destroy = function() {
        this.destroyed = true;
        this.objects = [];
    }

    var Formation = function(x, y) {
        this.x = x;
        this.y = y;
        this.planes = [];
    };

    Formation.prototype.addPlane = function(formation_x, formation_y, color) {
        var plane_x = this.x + formation_x, plane_y = this.y + formation_y;
        var plane = new JetPlane(resources.jet_img, plane_x, plane_y, color, formation_x, formation_y);
        this.planes.push(plane);
        return plane;
    };

    Formation.prototype.travelTo = function(x, y, v) {
        var f_plane;
        for (var i in this.planes) {
            f_plane = this.planes[i];
            f_plane.travelTo(f_plane.formation_x + x, f_plane.formation_y + y, v)
        }
    };

    Formation.prototype.tick = function(ctx) {
        for (var i in this.planes) {
            if (this.planes[i].destroyed) {
                _l("deleting plane " + i)
                this.planes.splice(i, 1);
            } else {
                this.planes[i].tick(ctx);
            }
        }

        if (this.planes.length == 0) {
            this.destroy();
        }
    };

    Formation.prototype.destroy = function() {
        this.destroyed = true;
    };

    var getRandomFormation = function(stage) {
        var y_to_zero = Math.random() > 0.5 ? true : false
        var init_y = y_to_zero ? stage.ctx.canvas.height : 10 + (stage.ctx.canvas.height - 10) * Math.random();
        var init_x = y_to_zero ? (stage.ctx.canvas.width / 2 - 10) * Math.random() : 10;

        _l("starting from:" + init_x + " ," + init_y);
        var formation = new Formation(init_x, init_y);

        formation.addPlane(0, 0, "255, 0, 0"); // Red
        formation.addPlane(50, -50, "255, 255, 0"); // Yellow
        formation.addPlane(100, 0, "0, 128, 0"); // Green

        var target_y = stage.ctx.canvas.height - init_y;
        var target_x = stage.ctx.canvas.width - init_x;

        formation.travelTo(target_x, target_y, 3 + 3 * Math.random());
        return formation;
    };

    var JetPlane = function(img, initX, initY, smoke_rgb, formation_x, formation_y) {
        this.img = img
        this.x = initX;
        this.y = initY;
        this.formation_x = formation_x;
        this.formation_y = formation_y
        this.smoke_particles_list = [];
        this.smoke_rgb = smoke_rgb;
        this.destroy_plane = false;
        this.pather = new PathMaker();
        return this;
    };

    JetPlane.prototype.draw = function(ctx) {
        ctx.save();
        var angle = Math.atan(this.pather.slope) + PI_half;
        //console.log(angle)
        ctx.translate(this.x, this.y);
        //ctx.translate(23, 32)
        ctx.rotate(angle)

        ctx.drawImage(this.img, 0, 0);
        //ctx.drawImage(this.img, this.x, this.y);
        ctx.restore();

        for (var i in this.smoke_particles_list) {
            if (this.smoke_particles_list[i].destroyed == true) {
                this.smoke_particles_list.splice(i, 1);
            } else {
                this.smoke_particles_list[i].draw(ctx);
            }
        }
    }

    JetPlane.prototype.travelTo = function(_x, _y, v) {
        this.pather.createPath(this.x, this.y, _x, _y, v);
    }

    JetPlane.prototype.tick = function(ctx) {
        //this.x = this.x + 5;
        this.pather.move();
        var angle = Math.atan(this.pather.slope) + PI_half;
        var adj_x = - this.formation_x + this.formation_x * Math.cos(angle) - this.formation_y * Math.sin(angle);
        var adj_y = - this.formation_y + this.formation_x * Math.sin(angle) + this.formation_y * Math.cos(angle);
        this.x = this.pather.x + adj_x;
        this.y = this.pather.y + adj_y;
        if (this.smoke_particles_list.length < 100 && !this.destroy_plane) {
            var delta_x = (11 + 2 * Math.random()) * Math.cos(angle) - (
