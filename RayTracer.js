import {Vector3, vectorSum, vectorDifference, vectorScaled} from './Vector3.js'

export class RayTracer {
    constructor(sceneInfo, image) {
        this.scene = sceneInfo;
        this.image = image;
        let eye = new Vector3(this.scene.v3_eye);
        let eyeOut = new Vector3(this.scene.v3_eyeOut);
        let up = new Vector3(this.scene.v3_up);

        this.camera= this.setUpCamera(eye,eyeOut,up);

        // clear image all white
        for (let i = 0; i < image.data.length; i++) {
            image.data[i] = 255;
        }
    }

    putPixel(row, col, r, g, b) {
        /*
        Update one pixel in the image array. (r,g,b) are 0-255 color values.
        */
        if (Math.round(row) != row) {
            console.error("Cannot put pixel in fractional row");
            return;
        }
        if (Math.round(col) != col) {
            console.error("Cannot put pixel in fractional col");
            return;
        }
        if (row < 0 || row >= this.image.height) {
            return;
        }
        if (col < 0 || col >= this.image.width) {
            return;
        }

        const index = 4 * (this.image.width * row + col);
        this.image.data[index + 0] = Math.round(r);
        this.image.data[index + 1] = Math.round(g);
        this.image.data[index + 2] = Math.round(b);
        this.image.data[index + 3] = 255;
    }

    // TODO
    render() {
         /*
        For every pixel of this.image, compute its color, then use putPixel() to set it. 
        */

        for (let row=0; row < this.scene.i_height; row++) {
            for (let col=0; col < this.scene.i_width; col++) {
                //compute ray
                let R = this.pixelToRay(row,col);
                let color = this.traceRay(R);
                this.putPixel(row,col,color.x*255,color.y*255,color.z*255);

            }
        }

    }
    
    setUpCamera(e, eyeOut, up){
        let w = new Vector3(-eyeOut.x, -eyeOut.y, -eyeOut.z);
        let u = up.crossProduct(w);
        let v = w.crossProduct(u);
        u.normalize();
        v.normalize();
        w.normalize();
        return [e,u,v,w];
    }
    
    pixelToRay(row, col) {

        let [e,u,v,w] = this.camera;
        const d = this.scene.f_imageplaneDistance;
        const l = this.scene.f_imageplaneWidth;
        const h = this.scene.f_imageplaneHeight;
        const A = e

        const sqHeight = h / this.scene.i_height;
        const sqWidth = l / this.scene.i_width;

        let wScaled = vectorScaled(w,d);
        let vScaled = vectorScaled(v,(h/2));
        let uScaled = vectorScaled(u,(l/2));
        
        const topLeft = vectorDifference(vectorSum(vectorDifference(A, wScaled), vScaled), uScaled);
        
        const firstPixel = vectorSum(vectorDifference(topLeft, vectorScaled(v,sqHeight/2)), vectorScaled(u,(sqWidth/2)));
        
        const B = vectorSum(vectorDifference(firstPixel, vectorScaled(v,row*sqHeight)), vectorScaled(u,col*sqWidth));
        const dir = vectorDifference(B,A)
        return new Ray(A, dir);
    }
    
    // TODO
    traceRay(ray) {
        let minDistance = Infinity;
        let hitRecord = null;
        const hits = ray.allHits(this.scene.a_geometries);
        if (hits.length > 0){
            //console.log(hits)
            for (const hit of hits){
                if(hit.length === 0) {
                    continue;
                }
                let temp = hit.t;
                if (hit.struckGeometry.s_type === "sphere" || hit.struckGeometry.s_type === "box"){
                    temp = Math.min(hit.t[0],hit.t[1]);  
                }
                
                if (temp < minDistance){
                    minDistance = temp;
                    hitRecord = hit;
                }      
            }
            const color = this.getColor(hitRecord);
            return new Vector3(color);
        }
        return [0,0,255];

    }
    
    // TODO
    getColor(record) {

        if (record === null){
            return [0,0,255];
        }
        const lights = this.scene.a_lights;
        let final = new Vector3(0,0,0);
        for (const light of lights){
            let color = new Vector3(this.whatLight(record,light));
            color.scaleBy(light.f_intensity);
            final = vectorSum(final,color)
            
        }
        return final;
    }
    
    whatLight(record,light){

        const pt = new Vector3(record.pt);
        let toLight = new Vector3(light.v3_position);
        toLight = vectorDifference(toLight,pt);
        const shadowRay = new Ray(pt,toLight);
        const hits = shadowRay.allHits(this.scene.a_geometries);
        for (const hit of hits) {
            let m = hit.t;
            if (hit.struckGeometry.s_type === "sphere" || hit.struckGeometry.s_type === "box" ){
                m = Math.max(m[0],m[1]);    
            }
            if ((m > 0.0001 && m < 1)) {
                // pt is in shadow, return black
                return [0, 0, 0];
            }
        }        
        const diffuseColor = this.diffuse(record, toLight);
        const highlight = this.highlight(record, toLight);
        const add = vectorSum(diffuseColor,highlight)
        return add;
    }
    
    diffuse(record, toLight){
        // compute diffuse component of color from given light. This is the lambert shading
        const color = new Vector3(record.struckGeometry.j_material.v3_diffuse);    
        const normal = record.normal;

        const alignment = toLight.dotProduct(normal);     
        const lengthNormal = normal.norm();
        const lengthToLight = toLight.norm();
        const m = Math.abs(alignment / (lengthNormal * lengthToLight));

        return color.scaleBy(m);
    }
    
    highlight(record, toLight){
        // phong shading
        
        const n = record.struckGeometry.j_material.f_specularity;
        if (n === undefined || n === -1){
            return new Vector3(0,0,0);
        }
        
        const pt = new Vector3(record.pt);
        const eye = new Vector3(this.scene.v3_eye);
        let toEye = vectorDifference(eye,pt);
        const normal = new Vector3(record.normal);
        
        let alpha = 2 * normal.dotProduct(toLight);
        alpha /= normal.dotProduct(normal);
    
        let outgoingLight = vectorDifference(vectorScaled(normal,alpha),toLight);
        
        toEye = toEye.normalize();
        outgoingLight = outgoingLight.normalize();
                               
        let specularAlignment = toEye.dotProduct(outgoingLight);
        
        if (specularAlignment < 0) {
            specularAlignment = 0;
        }
        
        let s = Math.pow(specularAlignment, n);
        let ret = new Vector3(1,1,1);
        ret.scaleBy(s);
        return ret;
    }
   
}

class Ray {
    constructor(start, dir) {
        this.start = start;
        this.dir = dir;
    }

    tToPt(t) {
        const ret = new Vector3(this.start).increaseByMultiple(this.dir, t);
        return ret;
    }
    
    allHits(geometries) {
        /* compute all hits between a ray and a list of geometries. Return a list of HitRecords*/
        
        let ret = [];
        for (const g of geometries) {
            const record = this.hit(g);
            if (record.length === undefined) {
                console.error("Return type of hit() should be an array.");
            }
            ret = ret.concat(record);
        }
        return ret;
    }
    
    hit(g) {
        if (g.s_type === 'sphere') {
            return this.hitSphere(g);
        }
        else if (g.s_type === 'sheet') {
            return this.hitSheet(g);
        }
        else if (g.s_type === 'box') {
            return this.hitBox(g);
        }
        else {
            console.error("Shape of type " + g.s_type + " is not supported");
        }
    }
    
    hitSheet(g) {
        /*
        Compute the intersection between the ray (this) and the given geometry g, a sheet.
        Return an instance of the HitRecord class.
        */
    
        const pt0 = g.v3_pt0;
        const pt1 = g.v3_pt1;
        const pt2 = g.v3_pt2;
        // compute d, normal, edge1, edge2 once only, to save time
        if (g.edge1 === undefined) {
            g.edge1 = vectorDifference(pt0, pt1);
            g.edge2 = vectorDifference(pt2, pt1);

            // edge1 and edge2 assumed to be orthogonal
            const unit1 = vectorDifference(pt0, pt1).normalize();
            const unit2 = vectorDifference(pt2, pt1).normalize();
            if (Math.abs(unit1.dotProduct(unit2)) > 0.01) {
                console.error(`Edges ${edge1} and ${edge2} are not orthogonal`);
            }

            // assume pts listed in ccw order, e.g. [1, 0, 0], [0,0,0], [0, 1, 0]
            g.normal = unit2.crossProduct(unit1);
            g.normal.normalize();

            // ray-plane intersection
            g.d = g.normal.dotProduct(pt1);
        }
        const t = (g.d - g.normal.dotProduct(this.start))/g.normal.dotProduct(this.dir);
        const pt = this.tToPt(t);
        // check if pt is within sheet
        let alpha = vectorDifference(pt,pt1).dotProduct(g.edge1);
        alpha /= g.edge1.dotProduct(g.edge1);
        let beta = vectorDifference(pt,pt1).dotProduct(g.edge2);
        beta /= g.edge2.dotProduct(g.edge2);

        if (alpha < 0 || alpha > 1 || beta < 0 || beta > 1) {
            // hit doesn't count
            return [];
        }
        const ret = new HitRecord(this, t, pt, g, g.normal);
        return [ret];
    }

    hitSphere(g) {
        /*
        Compute the intersection between the ray (this) and the given geometry g, a sphere.
        Return an instance of the HitRecord class.
        */
        
        let ret = new HitRecord();
        const center = g.v3_center;
        const r = g.f_radius;
        const dir = this.dir;
        const start = this.start;
        
        const u = vectorDifference(start,center)
        const v = dir;
        const a = v.dotProduct(v);
        const b = v.dotProduct(u)*2;
        const c = u.dotProduct(u)-r*r;
        
        if (b*b-4*a*c < 0) {
            return [];
        }
        
        let distance = 0;
        let t0 = (-b-Math.sqrt(b*b-4*a*c))/(2*a);
        let t1 = (-b+Math.sqrt(b*b-4*a*c))/(2*a);
        if (t0>0 && t1 > 0) {
            distance = Math.min(t0,t1);
        }
        else if (t0>0) {
            distance = t0;
        }
        else if (t1>0) {
            distance = t1;
        }
      
        // next return [t0,t1]
        const pt = this.tToPt(distance);
        ret.normal = vectorDifference(pt, g.v3_center);
        ret.t = [t0,t1];
        ret.pt = pt;
        ret.ray = this;
        ret.struckGeometry = g;

        return [ret];
    }

    hitBox(g) {
        /*
        Compute the intersection between the ray (this) and the given geometry g, a box.
        Return an instance of the HitRecord class.
        */
        
        const width = g.v3_dim.x;
        const height = g.v3_dim.y;
        const depth = g.v3_dim.z;
        
        const minPt = g.v3_minPt;
        const xStep = new Vector3(width, 0, 0);
        const yStep = new Vector3(0, height, 0);
        const zStep = new Vector3(0, 0, depth);
        
        // back sheet
        const face1 = {
            v3_pt0: new Vector3(minPt).increaseBy(zStep).increaseBy(yStep),
            v3_pt1: new Vector3(minPt).increaseBy(zStep),
            v3_pt2: new Vector3(minPt).increaseBy(zStep).increaseBy(xStep),
            s_type : "sheet",
            d : null,
            normal : null,
            j_material : {v3_diffuse: g.j_material.v3_diffuse,
                 f_specularity: g.j_material.f_specularity},
        };
        
        // bottom sheet
        const face2 = {
            v3_pt0: new Vector3(minPt),
            v3_pt1: new Vector3(minPt).increaseBy(zStep),
            v3_pt2: new Vector3(minPt).increaseBy(xStep).increaseBy(zStep),
            s_type : "sheet",
            d : null,
            normal : null,
            j_material : {v3_diffuse: g.j_material.v3_diffuse,
                 f_specularity: g.j_material.f_specularity},
        };
        
        // top sheet 
        const face3 = {
            v3_pt0: new Vector3(minPt).increaseBy(zStep).increaseBy(yStep),
            v3_pt1: new Vector3(minPt).increaseBy(yStep),
            v3_pt2: new Vector3(minPt).increaseBy(xStep).increaseBy(yStep),
            s_type : "sheet",
            d : null,
            normal : null,
            j_material : {v3_diffuse: g.j_material.v3_diffuse,
                 f_specularity: g.j_material.f_specularity},
        };
        
        
        // left sheet
        const face4 = {
            v3_pt0: new Vector3(minPt).increaseBy(zStep).increaseBy(yStep),
            v3_pt1: new Vector3(minPt).increaseBy(zStep),
            v3_pt2: new Vector3(minPt),
            s_type : "sheet",
            d : null,
            normal : null,
            j_material : {v3_diffuse: g.j_material.v3_diffuse,
                 f_specularity: g.j_material.f_specularity},
        };

        
        // right sheet
        const face5 = {
            v3_pt0: new Vector3(minPt).increaseBy(xStep).increaseBy(yStep),
            v3_pt1: new Vector3(minPt).increaseBy(xStep),
            v3_pt2: new Vector3(minPt).increaseBy(xStep).increaseBy(zStep),
            s_type : "sheet",
            d : null,
            normal : null,
            j_material : {v3_diffuse: g.j_material.v3_diffuse,
                 f_specularity: g.j_material.f_specularity},
        };
        
        // front sheet
        const face6 = {
            v3_pt0: new Vector3(minPt).increaseBy(yStep),
            v3_pt1: new Vector3(minPt),
            v3_pt2: new Vector3(minPt).increaseBy(xStep),
            s_type : "sheet",
            d : null,
            normal : null,
            j_material : {v3_diffuse: g.j_material.v3_diffuse,
                 f_specularity: g.j_material.f_specularity},
        };
        let sheets = [face1,face2,face3,face4,face5,face6];
        
        let ret = [];
        let closest = Infinity;
        let farthest = 0;
        
        for (const sheet of sheets){
            let hit = this.hitSheet(sheet);
            if (hit.length === 0 || hit[0].t <= 0){
                continue;
            }
            if (hit[0].t < closest && hit[0].t > 0){
                ret = hit 
                closest = hit[0].t
            }
            if (hit[0].t > farthest){
                farthest = hit[0].t
                hit[0].farthest = hit[0].t
            }
            if(ret.length === 0) {
                continue;
            }
            ret[0].t = [closest,farthest]
            ret[0].struckGeometry.s_type = "box"
        }     
        return ret;         
    }
}

class HitRecord {
    constructor(ray, t, pt, struckGeometry, normal) {
        this.ray = ray; // ray that was involved
        this.t = t; // t-value of intersection along ray
        this.pt = pt; // vector3, point where the ray hit
        this.struckGeometry = struckGeometry; // object that was hit
        this.normal = normal; // normal vector of struckGeometry at pt
    }
}