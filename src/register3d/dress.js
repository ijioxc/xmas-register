// Original procedural garment meshes. No external images, textures or models.
import * as THREE from 'three';

export const SHOE_ROW_Z = 182;
export const SHOE_SCALE = .66;

export function createFittingRoom(scene, lightPosition, draw) {
  const gallery = new THREE.Group();
  scene.add(gallery);
  gallery.visible = false;
  const exhibitLights = [];
  for (const x of [-150,-50,50,150]) {
    const light = new THREE.SpotLight(0xffecd8, 2.4, 0, .18, .72, 0);
    light.position.set(x, 275, 50);
    light.target.position.set(x, 0, 50);
    gallery.add(light, light.target);
    exhibitLights.push(light);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(96,96), new THREE.ShaderMaterial({
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      vertexShader:'varying vec2 uvFloor; void main(){ uvFloor=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader:'varying vec2 uvFloor; void main(){ float a=1.-smoothstep(.15,.5,length(uvFloor-.5)); gl_FragColor=vec4(1.,.76,.48,.26*a); }',
    }));
    pool.rotation.x=-Math.PI/2;
    pool.position.set(x,.65,50);
    gallery.add(pool);
  }
  const shoeLight = new THREE.SpotLight(0xffecd8, 0, 0, .06, .7, 0);
  shoeLight.position.copy(lightPosition);
  gallery.add(shoeLight, shoeLight.target);
  const fabric = (color, roughness = .84) => new THREE.MeshStandardMaterial({
    color, roughness, side: THREE.DoubleSide, emissive: color, emissiveIntensity: .14,
  });
  const wood = fabric(0xcba779), ivory = fabric(0xf1e5ce), green = fabric(0x22463a);
  const satin = fabric(0x40594b, .48), wool = fabric(0x262824), velvet = fabric(0x85283c, .54);
  const gold = fabric(0xd8b885, .45);
  function mesh(parent, geometry, material) {
    const item = new THREE.Mesh(geometry, material);
    item.castShadow = true; item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  // Horizontal elliptical sections, ordered from hem to neckline.
  function shell(parent, rings, material, deform, start = -Math.PI, end = Math.PI) {
    const points = [], indices = [], count = 80;
    for (const [y, width, depth] of rings) {
      for (let i = 0; i <= count; i++) {
        const a = start + (end - start) * i / count;
        const p = new THREE.Vector3(width * Math.sin(a), y, depth * Math.cos(a));
        deform?.(p, a, y, width, depth);
        points.push(p.x, p.y, p.z);
      }
    }
    for (let j = 1; j < rings.length; j++) for (let i = 0; i < count; i++) {
      const n = (j - 1) * (count + 1) + i;
      indices.push(n, n + 1, n + count + 1, n + 1, n + count + 2, n + count + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    g.setIndex(indices); g.computeVertexNormals();
    return mesh(parent, g, material);
  }
  function outfit(variant, menswear = false) {
    const ladySuit = !menswear && variant === 3;
    const stand = new THREE.Group();
  const base = [[0,29],[2,34],[5,34],[7,31],[8,28],[11,26],[13,19],[16,11],[20,6],[26,4],[84,4]];
  const pedestal = menswear ? base : [[0,23],[2,29],[5,29],[7,26],[9,22],[11,8],[13,3],[84,3]];
  mesh(stand, new THREE.LatheGeometry(pedestal.map(([y,r]) => new THREE.Vector2(r,y)),80), wood);
  const body = [[81,12,8],[89,19,12],[100,15,10],[111,14,10],[128,21,14],[140,22,11],[146,10,8],[149,6,6],[155,6,6],[156,.2,.2]];
  shell(stand, body, ivory, (point, angle, y) => {
    // The mannequin tapers inside the garment. Only the neckline is exposed.
    const inset = THREE.MathUtils.smoothstep(y, 139, 148);
    point.x *= .67 + .33 * inset;
    point.z *= .67 + .33 * inset;
  });
  const cap = mesh(stand,new THREE.SphereGeometry(4,24,12),wood);
  cap.position.y = 158;
  if (menswear || ladySuit) {
    const suit = variant === 0 || ladySuit;
    const blazer = variant === 1;
    const polo = variant === 2;
    const top = ladySuit ? fabric(0x41434a, .96) : [fabric(0x303b49), fabric(0xa78a62), green, ivory][variant];
    const trousers = suit ? top : [wool, wool, fabric(0xb7ad96), wool][variant];
    for (const sign of [-1, 1]) {
      const legProfile = ladySuit
        ? [[21,8.7,7],[29,8.7,7.5],[62,8.3,8],[92,10,11],[103,9,10]]
        : [[21,7,7],[28,7.2,8],[58,8,8],[82,9,11],[94,9.3,11],[100,8,9]];
      const leg = shell(stand, legProfile, trousers, (point, angle, y) => {
        // Pressed front crease fading into the hip and hem.
        const crease = Math.max(0, Math.cos(angle)) ** 36;
        const falloff = THREE.MathUtils.smoothstep(y, 21, 33) * (1 - THREE.MathUtils.smoothstep(y, 76, 98));
        point.z += 1.7 * crease * falloff;
      });
      leg.position.x = sign * 9;
      if (suit && !ladySuit) {
        const sleeve = shell(stand, [[0,5.6,6],[5,6,6.5],[38.88,7,8],[51,8,8],[54,4,5]], top);
        sleeve.position.set(sign * 31, 88, 0);
        sleeve.rotation.z = sign * .2;
      } else {
        // Start inside the shoulder seam and taper along the natural arm angle.
        const shoulder = new THREE.Vector3(sign * (ladySuit ? 16 : 20), ladySuit ? 139 : 142, 0);
        const cuff = new THREE.Vector3(sign * (polo ? 29 : ladySuit ? 27 : 32), polo ? 118 : 94, 0);
        const arm = shoulder.clone().sub(cuff);
        const length = arm.length();
        const sleeve = shell(stand, [
          [0, polo ? 7 : 5.3, 5.8], [3, 6.5, 6.3],
          [length*.45, 6.8, 7.2], [length*.78, 8, 8],
          [length, ladySuit ? 5.5 : 6.7, 6.2], [length+2, ladySuit ? 1 : 4, 3.5], [length+3,.3,.3],
        ], top);
        sleeve.position.copy(cuff);
        sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), arm.normalize());
        if (!suit && !blazer) {
          const cuffBand = shell(sleeve, [[0,6.1,6],[3,6.6,6.5]], polo ? satin : fabric(0xf5eee3));
          cuffBand.position.y = .2;
        }
      }
    }

    const cut = (p, angle, y, width, depth, side) => {
      const opening = suit ? Math.max(0,(y-112)/35)*.43 : blazer ? Math.max(0,(y-111)/36)*.62 : 0;
      const edgeAngle = angle + side * opening * (1-Math.abs(angle)/Math.PI);
      p.x = width * Math.sin(edgeAngle);
      p.z = depth * Math.cos(edgeAngle);
    };
    const jacket = [[suit?83:91,21,15],[98,19,14],[113,18,14],[129,22,16],[141,24,12],[146,17,10],[149,7,7]];
    const shirt = polo
      ? [[94,17,12],[99,18,13],[105,20,14],[129,22,15],[138,24,13],[142,23.8,12],[145,21,10],[147,14,8],[150,7,7]]
      : [[98,15,11],[102,18,13],[108,19,13],[126,20,15],[138,24,13],[143,23,11.8],[145.5,20.5,10],[148,12,8],[150,7,7]];
    const profile = ladySuit ? [[96,19,14],[106,16,11],[115,15,11],[128,20,15],[138,22,12],[143,21,10],[146,13,9],[149,7,7]] : suit || blazer ? jacket : shirt;
    for (const sign of [-1,1]) {
      // Split the front at the center seam. The suit fronts meet below the lapels.
      shell(stand, profile, top, (p,angle,y,width,depth) => cut(p,angle,y,width,depth,sign), sign < 0 ? -Math.PI : 0, sign < 0 ? 0 : Math.PI);
      if (suit || blazer) {
        if (blazer) {
          // Raised collar rolls around the nape and folds toward each lapel notch.
          shell(stand, [[147,9,7.8],[151,8.4,7.3],[153,7.4,6.8]], top, undefined,
            sign < 0 ? -Math.PI : .55, sign < 0 ? -.55 : Math.PI);
          const fold = new THREE.BufferGeometry();
          fold.setAttribute('position', new THREE.Float32BufferAttribute([
            sign*4,152,6.8, sign*8,152,2, sign*17,145,8,
            sign*12,141,13.6, sign*7,146,11.8
          ],3));
          fold.setIndex([0,1,4,1,2,4,2,3,4]);
          fold.computeVertexNormals();
          mesh(stand,fold,fabric(0x896e4e));
        }
        const edge = new THREE.Shape();
        edge.moveTo(sign*5,148); edge.lineTo(sign*15,141);
        edge.lineTo(sign*11,137); edge.lineTo(sign*13,134);
        edge.lineTo(sign*(suit?0:1),suit?112:113); edge.closePath();
        const lapelGeometry = new THREE.ExtrudeGeometry(edge, { depth: .55, bevelThickness: .25, bevelSize: .3, bevelSegments: 1 });
        {
          const positions = lapelGeometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i);
            positions.setZ(i, positions.getZ(i) - 7 * THREE.MathUtils.smoothstep(y, 133, 148));
          }
          lapelGeometry.computeVertexNormals();
        }
        const lapel = mesh(stand, lapelGeometry, ladySuit ? fabric(0x34363e,.75) : suit ? fabric(0x485469) : fabric(0xcab290));
        lapel.position.z = ladySuit ? 15.3 : 15.7;
      } else {
        const collar = new THREE.BufferGeometry();
        collar.setAttribute('position',new THREE.Float32BufferAttribute([
          sign*4,151,7, sign*10,147,8, sign*(polo?14:8),polo?142:136,14,
          sign*4,143,15, sign*1.5,146,12,
        ],3));
        collar.setIndex([0,1,3,1,2,3,0,3,4]);
        collar.computeVertexNormals();
        mesh(stand,collar,polo ? fabric(0x527766) : fabric(0xfff9ee));
      }
    }
    if (!suit && !blazer) {
      // Follow the chest so the placket lies on the cloth at every height.
      const rows = shirt.filter(([y]) => y <= 144 && (!polo || y >= 129));
      const width = polo ? 2.4 : 1.4;
      const strip = new THREE.BufferGeometry();
      const vertices = rows.flatMap(([y,,z]) => [-width,y,z+.3,width,y,z+.3]);
      strip.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));
      strip.setIndex(rows.slice(1).flatMap((_,i) => [2*i,2*i+1,2*i+2,2*i+1,2*i+3,2*i+2]));
      strip.computeVertexNormals();
      mesh(stand, strip, polo ? satin : fabric(0xe2d9ca));
      if (polo) {
        shell(stand, [[94,17.3,12.3],[99,18.3,13.3]], satin);
      }
    }
    const buttonMaterial = ladySuit ? gold : fabric(suit ? 0x20252d : 0x876c50);
    if (suit || blazer) {
      const pocket = mesh(stand, new THREE.BoxGeometry(7,1,.6), top);
      pocket.position.set(12,130,14.7);
      pocket.rotation.z = -.13;
      if (menswear) {
        const pocketTrim = fabric(blazer ? 0x997c56 : 0x384554);
        for (const side of [-1,1]) {
          const flap = mesh(stand, new THREE.BoxGeometry(blazer ? 9 : 8, blazer ? 6 : 2, .9), pocketTrim);
          flap.position.set(side*12, blazer ? 104 : 101, 10.8);
          flap.rotation.y = side*.52;
        }
      }
      if (ladySuit) {
        pocket.position.z = 12.8;
        const welt = fabric(0x545762);
        for (const side of [-1, 1]) {
          const flap = mesh(stand, new THREE.BoxGeometry(7.5, 1.5, 1), welt);
          flap.position.set(side * 10, 107, 9.4);
          flap.rotation.y = side * .38;
        }
      }
    }
    const buttonYs = ladySuit ? [111] : suit ? [111,102] : blazer ? [111] : polo ? [142,138,134] : [135,126,117,108];
    for (const y of buttonYs) {
      const button = mesh(stand,new THREE.SphereGeometry(1.15,12,8),buttonMaterial);
      const upper = profile.findIndex(([height]) => height >= y);
      const [lowY,,lowZ] = profile[upper-1];
      const [highY,,highZ] = profile[upper];
      const surface = THREE.MathUtils.lerp(lowZ, highZ, (y-lowY)/(highY-lowY));
      button.scale.z = .56;
      button.position.set(0,y,ladySuit ? 12 : surface+.7);
    }
    if (!suit && !blazer && !polo) {
      const belt = shell(stand, [[95,16.7,12],[99,16.7,12]], fabric(0x493b30));
      belt.position.z = .25;
      const buckle = mesh(stand,new THREE.BoxGeometry(4,2.5,.8),gold);
      buckle.position.set(0,97,12.7);
    }
    if (suit && !ladySuit) {
      const tie = new THREE.Shape();
      tie.moveTo(-2,148); tie.lineTo(2,148); tie.lineTo(3,119);
      tie.lineTo(0,115); tie.lineTo(-3,119); tie.closePath();
      mesh(stand,new THREE.ShapeGeometry(tie),velvet).position.z=15.4;
    }
  } else {
    const bodiceMaterial = [ivory, satin, fabric(0x7f263b,.62)][variant];
    const waist = [106, 16, 12];
    shell(stand, [waist,[112,16.3,12.5],[124,19,14],[134,21,14],[141,19,12]], bodiceMaterial,
      (point, angle, y) => {
        if (y > 132) point.y += (y-132)*.65*Math.sin(angle);
      });
    // Both halves use the same waist ring, with the band covering the join.
    const hem = [36, 60, 24][variant];
    const flare = [39, 37, 43][variant];
    const skirtProfile = [[hem,flare,flare*.77],[hem+5,flare-2,flare*.73],
      [hem+(106-hem)*.42,29,23],[hem+(106-hem)*.78,20,15],waist];
    const isGown = variant === 2;
    const profile = isGown
      ? new THREE.CatmullRomCurve3(skirtProfile.map(ring => new THREE.Vector3(...ring))).getPoints(28).map(point => point.toArray())
      : skirtProfile;
    shell(stand, profile, bodiceMaterial, (point, angle, y) => {
      const t = (106-y)/(106-hem);
      const fold = isGown ? .72*Math.cos(6*angle+.45*t) + .28*Math.cos(9*angle+1.3*t) : Math.cos(9*angle+1.7*t);
      const wave = 1 + (isGown ? .16 : .10)*t*fold;
      point.x = point.x*wave + (isGown ? 3 : 6)*t*t;
      point.z *= wave;
      point.y += t*t*(2*fold + (isGown ? 4 : 3)*Math.cos(angle));
    });
    shell(stand, [[104.5,16.7,12.6],[107.5,16.7,12.6]], bodiceMaterial);

    }
    return stand;
  }

  const leather = [0x634538, 0x81433b, 0xd9b69b, 0x9a454a].map(color =>
    new THREE.MeshPhysicalMaterial({color, side:THREE.DoubleSide, roughness:.32, clearcoat:.55,
      clearcoatRoughness:.28, emissive:color, emissiveIntensity:.17}));
  for (const x of [-150,-50,50,150]) {
    const light = new THREE.SpotLight(0xffe7cb, 2.7, 0, .24, .8, 0);
    light.position.set(x-28,135,SHOE_ROW_Z+55);
    light.target.position.set(x,10,SHOE_ROW_Z);
    gallery.add(light,light.target);
  }
  const fill = new THREE.HemisphereLight(0xffebd8,0x87929a,.85);
  gallery.add(fill);
  const lining = fabric(0x372824);
  function shoes(style, menswear = false) {
    const upper = menswear ? [wool, leather[1], ivory, wool][style] : leather[style];
    const sneaker = menswear && style >= 2;
    const sole = sneaker && style === 2 ? ivory : lining;
    const pair = new THREE.Group();
    for (const side of [-1, 1]) {
      const shoe = new THREE.Group();
      pair.add(shoe);
      shoe.position.set(side*14,0,side*3);
      shoe.rotation.y=side*.1+.22;
      // Sculpt the upper from cross-sections running heel to toe.
      const sections = [[-24,4,9],[-21,8,15],[-15,9,16],[-7,9,16],[1,10,17],[10,11,13],[20,11,9],[27,8,7],[30,2,5]];
      const points=[], indices=[];
      const steps=18;
      for (const [z,w,h] of sections) {
        const lift=!menswear && style>1 ? Math.max(0,(-z+8)/32)*6 : 0;
        for(let i=0;i<=steps;i++) {
          const angle=i*Math.PI/steps;
          points.push(Math.cos(angle)*w,2+lift+Math.sin(angle)*(!menswear && style>1?h*.74:h),z);
        }
      }
      for(let j=1;j<sections.length;j++) for(let i=0;i<steps;i++) {
        const n=(j-1)*(steps+1)+i;
        indices.push(n,n+1,n+steps+1,n+1,n+steps+2,n+steps+1);
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3)); geo.setIndex(indices); geo.computeVertexNormals();
      mesh(shoe,geo,upper);
      function oval(x,y,z,w,h,d,mat) {
        const o=mesh(shoe,new THREE.SphereGeometry(1,24,12),mat);
        o.scale.set(w,h,d); o.position.set(x,y,z); return o;
      }
      oval(0,2,5,11,sneaker?3.6:2,27,sole);
      if (sneaker) {
        const sidewall = oval(0,3.4,5,11.3,2.9,27,sole);
        sidewall.scale.z = 28;
      }
      if (menswear && style === 0) {
        const toeSeam = oval(0,11.4,18,9,.35,.65,fabric(0x4c4b46));
        toeSeam.rotation.x = -.12;
      }
      oval(0,style>1?17.4:18,-11,6,1.4,style>1?12:8,lining);
      if(!menswear && style>1) { const heel=mesh(shoe,new THREE.BoxGeometry(11,8,11),leather[style]); heel.position.set(0,4,-18); }
      if(style===1 || (!menswear && style===3)) oval(0,style===1?17:16,style===1?4:-3,9,2.3,3,leather[style]);
      if(!menswear && style===0) {
        const shaft=shell(shoe,[[9,9,11],[18,8,9],[32,9,9],[48,11,10],[56,11,10],[57,10,9]],leather[style]);
        shaft.position.z=-15;
      }
      if(!menswear && style===3) oval(8,15,-3,2,2,2,gold);
      if (menswear && style !== 1) {
        const laces = style === 2 ? ivory : fabric(0x414448);
        for(let i=0;i<4;i++) oval(0,18-i*.7,-3+i*3,5,.65,.85,laces);
      }

    }
    return pair;
  }

  const gentlemanIds = ['m','blazer','polo','shirt'];
  const ladyIds = ['ivory','short','f','skirt'];
  const shoeIds = ['boot','loafer','pump','mary'];
  const gentlemanShoeIds = ['oxford','g-loafer','white-leather','black-leather'];
  function makeRack(ids, shoeIds, menswear, offstageX) {
    const group = new THREE.Group();
    group.visible = false;
    gallery.add(group);
    const pieces = [
      ...ids.map((_, i) => outfit(i, menswear)),
      ...shoeIds.map((_, i) => shoes(i, menswear)),
    ];
    const slots = pieces.map((piece, i) => {
      const column = i % 4;
      const home = (column - 1.5) * 100;
      const parked = home + offstageX + Math.sign(offstageX) * [0, 24, 12, 36][column];
      const isShoe = i >= 4;
      piece.position.set(parked, 1, isShoe ? SHOE_ROW_Z : 50);
      piece.scale.setScalar(isShoe ? SHOE_SCALE : .78);
      piece.rotation.y = .13;
      group.add(piece);
      return { home, parked };
    });
    return { group, pieces, slots, ids: [...ids, ...shoeIds], fromLeft: offstageX < 0 };
  }

  const racks = {
    f: makeRack(ladyIds, shoeIds, false, -520),
    m: makeRack(gentlemanIds, gentlemanShoeIds, true, 520),
  };
  let frame;
  let activeRack;
  let slide;
  return (id, family) => {
    cancelAnimationFrame(frame);
    gallery.visible = id !== null;
    if (!gallery.visible) {
      activeRack = slide = undefined;
      for (const rack of Object.values(racks)) {
        rack.group.visible = false;
        rack.pieces.forEach((piece, i) => { piece.position.x = rack.slots[i].parked; });
      }
      draw(racks);
      return;
    }

    const rack = racks[family === 'm' ? 'm' : 'f'];
    const other = racks[rack === racks.m ? 'f' : 'm'];
    const start = performance.now();
    const switching = rack !== activeRack;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (switching) {
      const reversing = Boolean(slide);
      const lead = other.group.visible && !reversing ? 165 : 0;
      const moves = (set, entering) => set.pieces.map((piece, i) => {
        const column = i % 4;
        const order = set.fromLeft === entering ? 3 - column : column;
        const delay = reversing ? 0 : [0, 64, 140, 196][order] + (i >= 4 ? 62 : 0);
        return {
          piece,
          from: piece.position.x,
          to: entering ? set.slots[i].home : set.slots[i].parked,
          delay: delay + (entering ? lead : 0),
          duration: (entering ? 575 : 525) + [0, 20, 40, 60][order],
          entering,
        };
      });
      slide = { start, moves: [...moves(rack, true), ...moves(other, false)] };
      activeRack = rack;
    }
    if (reducedMotion) slide = undefined;
    rack.group.visible = true;

    const index = rack.ids.indexOf(id);
    const target = rack.pieces[index < 0 ? 2 : index];
    exhibitLights.forEach((light, i) => { light.intensity = i === index ? 4.6 : 3.7; });
    shoeLight.intensity = index >= 4 ? 2 : 0;
    rack.pieces.forEach(piece => { piece.rotation.y = .13; });
    const turnDuration = index >= 0 && !switching && !reducedMotion ? 650 : 0;

    function animate(now) {
      if (slide) {
        const elapsed = now - slide.start;
        let moving = false;
        let leaving = false;
        for (const { piece, from, to, delay, duration, entering } of slide.moves) {
          const p = Math.max(0, Math.min(1, (elapsed - delay) / duration));
          const eased = entering
            ? 1 - (1 - p) ** 3 * (1 + 3 * p)
            : p ** 2 * (3 - 2 * p);
          piece.position.x = from + (to - from) * eased;
          moving ||= p < 1 && from !== to;
          leaving ||= !entering && p < 1 && from !== to;
        }
        other.group.visible &&= leaving;
        if (!moving) slide = undefined;
      } else {
        rack.pieces.forEach((piece, i) => { piece.position.x = rack.slots[i].home; });
        other.pieces.forEach((piece, i) => { piece.position.x = other.slots[i].parked; });
        other.group.visible = false;
      }
      const turn = turnDuration ? Math.max(0, Math.min(1, (now - start) / turnDuration)) : 1;
      if (index >= 0) target.rotation.y = .32 - .85 * (1 - turn) ** 3;
      shoeLight.target.position.copy(target.position);
      shoeLight.target.position.y += 12;
      draw(racks);
      if (slide || turn < 1) frame = requestAnimationFrame(animate);
    }
    animate(start);
  };
}
