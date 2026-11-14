"""Generate golden values for ZEHN stats tests with SciPy.
Command: python3 tools/golden.py   (writes test/golden/*.json)"""
import json, sys, numpy as np, scipy, scipy.stats as st, scipy.special as sp
out = {"generator": "SciPy %s / NumPy %s" % (scipy.__version__, np.__version__), "command": "python3 tools/golden.py"}
# distributions at 10 points each
out["tP2"] = [{"t": t, "df": df, "p": float(2*st.t.sf(abs(t), df))} for t, df in [(2.228,10),(1.0,5),(2.5,20),(0.3,3),(3.1,40),(1.96,1000),(4.5,7),(-2.1,15),(0.0,9),(2.7,2)]]
out["fP"] = [{"F": f, "d1": a, "d2": b, "p": float(st.f.sf(f,a,b))} for f,a,b in [(3.354,2,27),(1.2,3,40),(5.0,1,10),(2.5,4,60),(0.8,2,12),(7.1,2,30),(3.0,5,100),(1.0,1,1),(4.2,3,16),(10.0,2,9)]]
out["chi2P"] = [{"x": x, "k": k, "p": float(st.chi2.sf(x,k))} for x,k in [(3.841,1),(5.991,2),(1.0,1),(10.0,4),(0.5,3),(20.0,10),(7.8,3),(2.2,2),(15.5,8),(30.0,20)]]
out["normCdf"] = [{"z": z, "p": float(st.norm.cdf(z))} for z in [-3,-2,-1.5,-0.5,0,0.5,1,1.645,2,3.2]]
out["normInv"] = [{"p": p, "z": float(st.norm.ppf(p))} for p in [0.001,0.01,0.025,0.1,0.3,0.5,0.7,0.9,0.975,0.999]]
out["pearsonP"] = []
json.dump(out, open("test/golden/dist.json","w"), indent=1)

rng = np.random.default_rng(20261114)
a = np.round(rng.normal(500, 60, 12), 1); b = np.round(rng.normal(450, 70, 14), 1)
pa = np.round(rng.normal(620, 80, 15), 1); pb = np.round(pa - rng.normal(35, 40, 15), 1)
g1, g2, g3 = [np.round(rng.normal(m, 10, 10), 1) for m in (50, 54, 58)]
x = np.round(rng.normal(10, 3, 20), 2); y = np.round(2.5*x + rng.normal(0, 4, 20), 2)
items = np.clip(np.round(rng.normal(3, 1, (30, 1)) + rng.normal(0, 0.8, (30, 6))), 1, 5).astype(int)
tab = [[30, 10], [15, 25]]; obs = [18, 22, 30, 30]
def alpha(m):
    k = m.shape[1]; return float(k/(k-1)*(1 - m.var(axis=0, ddof=1).sum()/m.sum(axis=1).var(ddof=1)))
ti = st.ttest_ind(a, b); tw = st.ttest_ind(a, b, equal_var=False); tp = st.ttest_rel(pa, pb)
an = st.f_oneway(g1, g2, g3); pr = st.pearsonr(x, y); lr = st.linregress(x, y)
c2 = st.chi2_contingency(tab, correction=False); gf = st.chisquare(obs)
sp_ = np.sqrt(((len(a)-1)*a.var(ddof=1)+(len(b)-1)*b.var(ddof=1))/(len(a)+len(b)-2))
s = {"generator": out["generator"], "command": out["command"],
 "data": {"a": a.tolist(), "b": b.tolist(), "pa": pa.tolist(), "pb": pb.tolist(), "g1": g1.tolist(), "g2": g2.tolist(), "g3": g3.tolist(), "x": x.tolist(), "y": y.tolist(), "items": items.tolist(), "tab": tab, "obs": obs},
 "describe_a": {"mean": float(a.mean()), "sd": float(a.std(ddof=1)), "sdPop": float(a.std(ddof=0)), "median": float(np.median(a)), "q1": float(np.quantile(a, .25)), "skew": float(st.skew(a, bias=False))},
 "t_ind": {"t": float(ti.statistic), "p": float(ti.pvalue), "df": len(a)+len(b)-2, "d": float((a.mean()-b.mean())/sp_)},
 "t_welch": {"t": float(tw.statistic), "p": float(tw.pvalue)},
 "t_paired": {"t": float(tp.statistic), "p": float(tp.pvalue), "dz": float((pa-pb).mean()/(pa-pb).std(ddof=1))},
 "anova": {"F": float(an.statistic), "p": float(an.pvalue)},
 "pearson": {"r": float(pr.statistic), "p": float(pr.pvalue)},
 "regression": {"b": float(lr.slope), "a": float(lr.intercept), "r2": float(lr.rvalue**2), "seB": float(lr.stderr)},
 "chi2_ind": {"chi2": float(c2[0]), "p": float(c2[1]), "df": int(c2[2])},
 "chi2_gof": {"chi2": float(gf.statistic), "p": float(gf.pvalue)},
 "alpha": alpha(items),
 "power_d05_n64": float(st.norm.cdf(0.5*np.sqrt(64/2) - st.norm.ppf(0.975))),
 "sdt": {"d": float(st.norm.ppf(.84)-st.norm.ppf(.16)), "c": float(-0.5*(st.norm.ppf(.84)+st.norm.ppf(.16)))}}
json.dump(s, open("test/golden/stats.json","w"), indent=1)
print("ok", s["t_ind"], s["anova"], s["alpha"])
