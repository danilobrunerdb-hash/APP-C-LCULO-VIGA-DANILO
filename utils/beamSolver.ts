import { BeamInput } from "../types";

// --- Matrix Math Helpers ---
const createMatrix = (rows: number, cols: number): number[][] => Array(rows).fill(0).map(() => Array(cols).fill(0));
const createVector = (size: number): number[] => Array(size).fill(0);

// Gaussian Elimination to solve Ax = b
const solveLinear = (A: number[][], b: number[]): number[] => {
    const n = A.length;
    const M = A.map(row => [...row]);
    const x = [...b];

    for (let i = 0; i < n; i++) {
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
        }
        
        [M[i], M[maxRow]] = [M[maxRow], M[i]];
        [x[i], x[maxRow]] = [x[maxRow], x[i]];

        if (Math.abs(M[i][i]) < 1e-10) continue; 

        for (let k = i + 1; k < n; k++) {
            const factor = M[k][i] / M[i][i];
            x[k] -= factor * x[i];
            for (let j = i; j < n; j++) {
                M[k][j] -= factor * M[i][j];
            }
        }
    }

    const res = createVector(n);
    for (let i = n - 1; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j < n; j++) {
            sum += M[i][j] * res[j];
        }
        if (Math.abs(M[i][i]) > 1e-10) {
            res[i] = (x[i] - sum) / M[i][i];
        }
    }
    return res;
};

export const solveBeam = (input: BeamInput) => {
    const { span, supports, pointLoads, distributedLoads, width, height, fck } = input;

    // 1. Material & Geometric Properties
    // Ecs approx per NBR 6118
    const Eci = 5600 * Math.sqrt(fck); // MPa
    const E = 0.85 * Eci * 1000; // Convert to kN/m²
    
    const b = width / 100; // m
    const h = height / 100; // m
    const I = (b * Math.pow(h, 3)) / 12; // m^4
    const EI = E * I;

    // 2. Discretization (Nodes)
    // Nodes at: Ends, Supports, Point Loads, Start/End of Dist Loads
    const rawNodes = new Set<number>();
    rawNodes.add(0);
    rawNodes.add(span);
    supports.forEach(s => rawNodes.add(s.position));
    // Ideally we put nodes at load points for FEM accuracy, 
    // but for the "Walk" method later, we just need reactions from FEM.
    // Putting nodes at supports is critical.
    
    const nodes = Array.from(rawNodes).sort((a, b) => a - b);
    const nodeMap = new Map<number, number>(); // Pos -> Index
    nodes.forEach((pos, idx) => nodeMap.set(pos, idx));

    const nNodes = nodes.length;
    const nDof = nNodes * 2; // Vertical (v) + Rotation (theta)
    
    const K = createMatrix(nDof, nDof);
    const F = createVector(nDof); // External Nodal Loads

    // 3. Assembly (Stiffness Matrix)
    for (let i = 0; i < nNodes - 1; i++) {
        const x1 = nodes[i];
        const x2 = nodes[i+1];
        const L = x2 - x1;
        if (L < 1e-5) continue;

        const k = EI / (L * L * L);
        // Local Stiffness Matrix coefficients
        const k11 = 12 * k;
        const k12 = 6 * L * k;
        const k22 = 4 * L * L * k;
        const k22_far = 2 * L * L * k;

        // DOFs: v1, t1, v2, t2
        const idx = [i*2, i*2+1, (i+1)*2, (i+1)*2+1];
        
        const Ke = [
            [k11, k12, -k11, k12],
            [k12, k22, -k12, k22_far],
            [-k11, -k12, k11, -k12],
            [k12, k22_far, -k12, k22]
        ];

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                K[idx[r]][idx[c]] += Ke[r][c];
            }
        }
    }

    // 4. Load Vector (Fixed End Actions - FEA)
    // We treat loads as member loads, calculate FEA, and add -FEA to Global F
    // Signs: Up = (+), CCW = (+)
    
    // 4.1 Distributed Loads (Trapezoidal Generic)
    distributedLoads.forEach(d => {
        // We need to integrate this over elements.
        // Simplification: We will apply "Equivalent Nodal Loads" based on simple beam formulas
        // But since nodes might not align with load starts, we iterate elements.
        
        for (let i = 0; i < nNodes - 1; i++) {
            const x1 = nodes[i];
            const x2 = nodes[i+1];
            const L = x2 - x1;
            
            // Check overlap
            const start = Math.max(x1, d.start);
            const end = Math.min(x2, d.end);
            
            if (end > start) {
                // Determine q at start and end of this segment
                const totalLen = d.end - d.start;
                const slope = (d.endMagnitude - d.startMagnitude) / (totalLen || 1);
                
                const q1 = d.startMagnitude + slope * (start - d.start);
                const q2 = d.startMagnitude + slope * (end - d.start);
                
                // This segment of load is trapezoidal from q1 to q2 over [start, end] within element [x1, x2]
                // For FEM exactness, we should use exact FEA formulas.
                // Simplified robust approach: Discretize load into point loads for FEA vector
                const nSegs = 5;
                const dx = (end - start) / nSegs;
                
                for(let k=0; k<nSegs; k++) {
                    const px = start + dx*k + dx/2;
                    const qx = q1 + (q2-q1)*(k+0.5)/nSegs;
                    const P = qx * dx; // Equivalent point load
                    
                    const a = px - x1;
                    const b = x2 - px;
                    
                    // FEA for point load P at distance 'a' from left
                    // Vertical Reactions
                    const R1 = (P * b * b * (3 * a + b)) / (L * L * L); // Up
                    const R2 = (P * a * a * (a + 3 * b)) / (L * L * L); // Up
                    // Moments (CCW +)
                    const M1 = (P * a * b * b) / (L * L); 
                    const M2 = -(P * a * a * b) / (L * L);
                    
                    // Add to Global F (Load is Down, so FEA resists Up. Equivalent Nodal Load = Load - FEA? 
                    // Nodal Load = Force applied. Force is P down (-).
                    // Or standard FEM: F = F_nodal - F_fixed.
                    // F_fixed (Reactions to hold nodes): R1 up (+), M1 (+), R2 (+), M2 (-).
                    // F_global -= F_fixed.
                    
                    const idx1 = i*2;
                    const idx2 = (i+1)*2;
                    
                    F[idx1] -= R1;
                    F[idx1+1] -= M1;
                    F[idx2] -= R2;
                    F[idx2+1] -= M2;
                }
            }
        }
    });

    // 4.2 Point Loads
    pointLoads.forEach(p => {
        // Find element containing load
        for (let i = 0; i < nNodes - 1; i++) {
            const x1 = nodes[i];
            const x2 = nodes[i+1];
            if (p.position >= x1 && p.position <= x2) {
                const L = x2 - x1;
                const a = p.position - x1;
                const b = x2 - p.position;
                
                if (L < 1e-5) continue; // Load on node?

                const P = p.magnitude;
                const R1 = (P * b * b * (3 * a + b)) / (L * L * L);
                const R2 = (P * a * a * (a + 3 * b)) / (L * L * L);
                const M1 = (P * a * b * b) / (L * L);
                const M2 = -(P * a * a * b) / (L * L);

                const idx1 = i*2;
                const idx2 = (i+1)*2;
                
                F[idx1] -= R1;
                F[idx1+1] -= M1;
                F[idx2] -= R2;
                F[idx2+1] -= M2;
                break;
            }
        }
    });

    // 5. Boundary Conditions
    const penalty = 1e20;
    supports.forEach(s => {
        // Snap support to nearest node
        const idx = nodes.findIndex(n => Math.abs(n - s.position) < 0.001);
        if (idx !== -1) {
            const vIndex = idx * 2;
            const tIndex = idx * 2 + 1;
            
            // Restrain Vertical (All supports)
            K[vIndex][vIndex] += penalty;
            
            // Restrain Rotation (Fixed only)
            if (s.type === 'fixed') {
                K[tIndex][tIndex] += penalty;
            }
        }
    });

    // 6. Solve for Displacements
    const d = solveLinear(K, F);

    // 7. Calculate Reactions
    // R = K * d - F_applied (Here F contains equivalent nodal loads, we need to be careful)
    // Easier way: The calculated displacements `d` are correct.
    // Reaction forces are the forces required to maintain `d` at supported nodes.
    // We can compute internal member forces at the ends of elements, then sum them at nodes to find the jump (Reaction).
    // OR simpler: Use the "Walk" method for diagrams, but we need initial values.
    // The "Walk" method needs the Reaction forces. 
    // Reaction = Internal Force Right of Node - Internal Force Left of Node + Applied Load at Node.
    // Let's compute member end forces.

    const memberForces: {
        nodeLeftIdx: number, 
        nodeRightIdx: number, 
        Fy_L: number, M_L: number, // Forces exerted BY the beam ON the node
        Fy_R: number, M_R: number 
    }[] = [];

    for (let i = 0; i < nNodes - 1; i++) {
        const x1 = nodes[i];
        const x2 = nodes[i+1];
        const L = x2 - x1;
        const k = EI / (L * L * L);
        
        const u = [d[i*2], d[i*2+1], d[(i+1)*2], d[(i+1)*2+1]];
        
        // Stiffness Forces (K_local * u)
        const f_stiff = [
            (12*k)*u[0] + (6*L*k)*u[1] + (-12*k)*u[2] + (6*L*k)*u[3],
            (6*L*k)*u[0] + (4*L*L*k)*u[1] + (-6*L*k)*u[2] + (2*L*L*k)*u[3],
            (-12*k)*u[0] + (-6*L*k)*u[1] + (12*k)*u[2] + (-6*L*k)*u[3],
            (6*L*k)*u[0] + (2*L*L*k)*u[1] + (-6*L*k)*u[2] + (4*L*L*k)*u[3]
        ];

        // Fixed End Actions (Add back what we subtracted from F)
        // Re-calculate FEA for this element
        const fea = [0, 0, 0, 0];
        // ... (Repeat FEA calc loop or store it previously. For brevity, re-looping distributed/point logic here is safe)
        // Simplified: The logic in step 4 subtracted R1, M1 etc from F. That means F_fixed = [R1, M1, R2, M2].
        // Total Member Force = K*u + F_fixed.
        
        // --- Repeat FEA Logic for Element i ---
        distributedLoads.forEach(d => {
             const start = Math.max(x1, d.start);
             const end = Math.min(x2, d.end);
             if (end > start) {
                const totalLen = d.end - d.start;
                const slope = (d.endMagnitude - d.startMagnitude) / (totalLen || 1);
                const q1 = d.startMagnitude + slope * (start - d.start);
                const q2 = d.startMagnitude + slope * (end - d.start);
                const nSegs = 5;
                const dx = (end - start) / nSegs;
                for(let k=0; k<nSegs; k++) {
                    const px = start + dx*k + dx/2;
                    const qx = q1 + (q2-q1)*(k+0.5)/nSegs;
                    const P = qx * dx; 
                    const a = px - x1; const b = x2 - px;
                    fea[0] += (P * b * b * (3 * a + b)) / (L * L * L);
                    fea[1] += (P * a * b * b) / (L * L);
                    fea[2] += (P * a * a * (a + 3 * b)) / (L * L * L);
                    fea[3] -= (P * a * a * b) / (L * L); // Note M2 sign
                }
             }
        });
        pointLoads.forEach(p => {
             if (p.position >= x1 && p.position <= x2) {
                const a = p.position - x1; const b = x2 - p.position;
                if (Math.abs(x2-x1) > 1e-5 && Math.min(a,b) > 1e-5) { // Internal
                    const P = p.magnitude;
                    fea[0] += (P * b * b * (3 * a + b)) / (L * L * L);
                    fea[1] += (P * a * b * b) / (L * L);
                    fea[2] += (P * a * a * (a + 3 * b)) / (L * L * L);
                    fea[3] -= (P * a * a * b) / (L * L);
                }
             }
        });
        // ---------------------------------------

        memberForces.push({
            nodeLeftIdx: i,
            nodeRightIdx: i+1,
            Fy_L: f_stiff[0] + fea[0], // Force UP on node
            M_L: f_stiff[1] + fea[1],  // Moment CCW on node
            Fy_R: f_stiff[2] + fea[2],
            M_R: f_stiff[3] + fea[3]
        });
    }

    // 8. Calculate Reactions at Nodes
    // Reaction = Sum of Member Forces acting on Node + External Loads on Node?
    // Actually: Node Equilibrium: R_ext - F_member_ends = 0  => R_ext = Sum(F_member_ends)
    // Be careful with signs. memberForces are forces ON the node from the beam.
    // Reaction is force ON the beam from support.
    // Actually, Stiffness eq: F_external = K*u. 
    // F_external includes Reaction + Applied Loads.
    // So Reaction = (K*u)_node - Applied_Loads_Node.
    // Let's rely on member forces:
    // Reaction @ Node i = (Fy_L of element starting i) + (Fy_R of element ending i)
    // Note: Fy_L is force from beam on node i. So beam pulls node. Support pulls node back?
    // Let's use standard: R = Sum(Internal Shears leaving node).
    
    const reactionMap = new Map<number, { Ry: number, Mz: number }>();
    
    nodes.forEach((x, i) => {
        let Ry = 0;
        let Mz = 0;
        
        // Contribution from element to the right (starts at i)
        if (i < nNodes - 1) {
            Ry += memberForces[i].Fy_L;
            Mz += memberForces[i].M_L;
        }
        
        // Contribution from element to the left (ends at i)
        if (i > 0) {
            Ry += memberForces[i-1].Fy_R;
            Mz += memberForces[i-1].M_R;
        }

        // Subtract directly applied nodal loads (if we had them in input specifically on nodes)
        // Our 'pointLoads' are generally member loads handled by FEA. 
        // If a point load is exactly on a node, our FEA logic above skips it (L approx).
        // Let's handle point loads on nodes explicitly:
        pointLoads.forEach(p => {
            if (Math.abs(p.position - x) < 0.001) {
                Ry -= p.magnitude; // Load is down (-), so it adds to the force the node must support? 
                // Wait, Ry above is "Force beam exerts on node".
                // Support Reaction must balance (Beam Force + External Load).
                // Support R_up = Ry_beam + Load_down. 
                // If Ry calculated above is Up positive force from stiffness?
                // Let's trace: Fy_L = shear force.
                // It is safer to use: Reaction = Internal Shear Right - Internal Shear Left.
            }
        });
        
        reactionMap.set(x, { Ry, Mz });
    });

    // 9. Generate Diagrams by "Walking" the beam (Method of Sections)
    // This handles all load shapes perfectly.
    // We start from left (x=0).
    // Initial V = 0, M = 0.
    // At x=0, add Reaction.
    
    const nPoints = 200;
    const dx = span / nPoints;
    const chartDataMoment = [];
    const chartDataShear = [];
    const chartDataDeflection = [];
    
    let maxMomentPos = 0, maxMomentNeg = 0, maxShear = 0, maxDeflection = 0;
    
    let V = 0;
    let M = 0;
    
    // Get reaction at x=0 if exists
    // Note: If x=0 is a free end, Reaction is 0.
    // If fixed, Reaction has values.
    
    for (let i = 0; i <= nPoints; i++) {
        const x = i * dx;
        const x_prev = (i > 0) ? (i - 1) * dx : 0;
        
        // integrate loads from x_prev to x
        if (i > 0) {
            const segLen = x - x_prev;
            // Distributed loads integration
            let loadForce = 0;
            let loadMoment = 0; // Moment caused by this load segment about x
            
            distributedLoads.forEach(d => {
                const start = Math.max(x_prev, d.start);
                const end = Math.min(x, d.end);
                if (end > start) {
                    const len = end - start;
                    // Trapezoid q1, q2
                    const totalL = d.end - d.start;
                    const slope = (d.endMagnitude - d.startMagnitude) / totalL;
                    const q1 = d.startMagnitude + slope * (start - d.start);
                    const q2 = d.startMagnitude + slope * (end - d.start);
                    
                    const area = len * (q1 + q2) / 2;
                    loadForce += area;
                    
                    // Centroid of this small slice (approx middle)
                    const distToX = x - (start + len/2);
                    loadMoment += area * distToX;
                }
            });
            
            // Update M first with previous V
            // M(x) = M(prev) + V(prev)*dx - LoadMoment
            M += V * segLen - loadMoment; 
            
            // Update V
            V -= loadForce;
        }

        // Add Point Loads/Reactions exactly at x
        // Use a tolerance window to capture discrete items
        const tolerance = dx / 2;
        
        // 1. Reactions
        supports.forEach(s => {
            if (Math.abs(s.position - x) <= tolerance) {
                // To avoid double counting, only add if this is the closest point step
                // Ideally, check if s.position is between x_prev and x, or exactly match.
                // Simple discrete check:
                if (Math.abs(s.position - x) < 0.001 || (s.position > x_prev && s.position <= x)) {
                    // We need the computed reaction.
                    // But wait, the FEM reaction calculated above includes internal forces.
                    // It's cleaner to just use the Support logic:
                    // V jumps by Ry. M jumps by Mz (if external moment applied).
                    // Wait, Mz reaction is external moment RESISTANCE.
                    // Internal Moment = External Moment?
                    // If support is Fixed at Left, it applies Moment Mz.
                    // Beam Moment starts at Mz.
                    // Let's retrieve R from map.
                    const r = reactionMap.get(s.position);
                    if (r) {
                        // Apply Reaction only ONCE.
                        // We need a flag or better check.
                    }
                }
            }
        });
        
        // Let's refine the loop. Integrate dx. Check for point entities in interval (x_prev, x].
        // Handle x=0 separately.
    }

    // --- RESTART DIAGRAM LOOP (Cleaner Logic) ---
    chartDataMoment.length = 0; chartDataShear.length = 0; chartDataDeflection.length = 0;
    V = 0; M = 0;
    
    // Add Reaction at x=0
    if (reactionMap.has(0)) {
        const r = reactionMap.get(0)!;
        V += r.Ry;
        M -= r.Mz; // Reaction Mz is CCW. Internal Moment convention: Sagging (CW on left cut) is positive.
        // If Support exerts CCW moment, it bends beam up (Hogging). Hogging is Negative.
        // So M += -Mz.
    }

    for (let i = 0; i <= nPoints; i++) {
        const x = i * dx;
        
        if (i > 0) {
            const x_prev = (i - 1) * dx;
            const segLen = x - x_prev;
            
            // 1. Integrate Distributed Load for dV and dM
            let dV_dist = 0;
            let dM_dist = 0; // Moment of the distributed load about x
            
            distributedLoads.forEach(d => {
                const s = Math.max(x_prev, d.start);
                const e = Math.min(x, d.end);
                if (e > s) {
                     const len = e - s;
                     const slope = (d.endMagnitude - d.startMagnitude) / (d.end - d.start);
                     const q_s = d.startMagnitude + slope * (s - d.start);
                     const q_e = d.startMagnitude + slope * (e - d.start);
                     
                     const force = len * (q_s + q_e) / 2;
                     dV_dist += force;
                     
                     // Centroid of trapezoid relative to s
                     const cent = (len/3) * (q_s + 2*q_e)/(q_s+q_e);
                     const distCentroidToX = (x - s) - cent; // from x back to centroid
                     // Actually: dM contribution is Force * lever_arm?
                     // No, change in M is V*dx - Load*arm?
                     // Standard: M_new = M_old + Area_Shear.
                     // Shear varies. V(y) = V_prev - int(q).
                     // M_new = M_old + int(V(y) dy).
                     // Let's use simple Euler or Trapezoidal integration of Shear.
                }
            });
            
            // Simple Step Integration
            // V varies due to load. Assume linear V variation for trapezoidal load.
            // M_new = M_prev + (V_prev + V_new_before_point_loads)/2 * dx
            
            const V_prev = V;
            V -= dV_dist; // V after distributed load effect
            const V_after_dist = V;
            
            M += (V_prev + V_after_dist) / 2 * segLen;
            
            // 2. Apply Point Loads and Reactions at x (if any)
            // Check for items in (x_prev, x]
            // We use a small epsilon to catch x exactly.
            
            // Reactions
            supports.forEach(s => {
                if (s.position > x_prev + 1e-9 && s.position <= x + 1e-9) {
                    const r = reactionMap.get(s.position);
                    if (r) {
                        V += r.Ry;
                        M -= r.Mz; // Jump in moment if moment reaction exists
                    }
                }
            });
            
            // Point Loads
            pointLoads.forEach(p => {
                 if (p.position > x_prev + 1e-9 && p.position <= x + 1e-9) {
                     V -= p.magnitude;
                 }
            });
        }
        
        chartDataShear.push({ x: x.toFixed(2), shear: V.toFixed(2) });
        chartDataMoment.push({ x: x.toFixed(2), moment: M.toFixed(2) });
        
        if (M > maxMomentPos) maxMomentPos = M;
        if (M < maxMomentNeg) maxMomentNeg = M;
        if (Math.abs(V) > maxShear) maxShear = Math.abs(V);
        
        // Deflection (Interpolate from FEM nodal results)
        // Find element
        const nodeIdx = nodes.findIndex(n => n >= x - 1e-5);
        let y_def = 0;
        if (nodeIdx !== -1 && nodeIdx < nNodes) {
             // Exact match?
             if (Math.abs(nodes[nodeIdx] - x) < 1e-4) {
                 y_def = d[nodeIdx*2];
             } else if (nodeIdx > 0) {
                 // Interpolate between nodeIdx-1 and nodeIdx
                 const n1 = nodeIdx - 1;
                 const n2 = nodeIdx;
                 const x1 = nodes[n1]; const x2 = nodes[n2];
                 const L = x2 - x1;
                 const localX = x - x1;
                 const xi = localX / L;
                 
                 const v1 = d[n1*2]; const t1 = d[n1*2+1];
                 const v2 = d[n2*2]; const t2 = d[n2*2+1];
                 
                 // Hermite Shape Functions
                 const N1 = 1 - 3*xi*xi + 2*xi*xi*xi;
                 const N2 = L * (xi - 2*xi*xi + xi*xi*xi);
                 const N3 = 3*xi*xi - 2*xi*xi*xi;
                 const N4 = L * (-xi*xi + xi*xi*xi);
                 
                 y_def = N1*v1 + N2*t1 + N3*v2 + N4*t2;
             }
        }
        
        // Convert y (m) to cm and flip sign for graph (Positive Load Down -> Negative y. Graph usually shows down as down)
        // Let's show displacement magnitude or real sign.
        // Usually: Down is negative y. Graph: Negative values.
        const y_cm = y_def * 100;
        chartDataDeflection.push({ x: x.toFixed(2), deflection: y_cm.toFixed(3) });
        if (Math.abs(y_cm) > Math.abs(maxDeflection)) maxDeflection = y_cm;
    }

    return {
        chartDataMoment,
        chartDataShear,
        chartDataDeflection,
        maxMomentPos,
        maxMomentNeg,
        maxShear,
        maxDeflection,
        R1: 0, R2: 0 // Legacy
    };
};