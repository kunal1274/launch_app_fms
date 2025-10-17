import { BrowserRouter, Link, Route, Routes, NavLink } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-brand-600" />
            <span className="font-semibold">FMS Dashboard</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            <NavLink to="/accounts" className={({isActive})=>`text-sm ${isActive? 'text-brand-700 font-semibold':'text-gray-600 hover:text-gray-900'}`}>Accounts</NavLink>
            <NavLink to="/journals" className={({isActive})=>`text-sm ${isActive? 'text-brand-700 font-semibold':'text-gray-600 hover:text-gray-900'}`}>GL Journals</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}

function Stat({label, value}:{label:string, value:string|number}){
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

// API base
const API = import.meta.env.VITE_API_BASE ?? '/fms/api/v0'

function AccountsPage(){
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|undefined>()
  const [rows, setRows] = useState<any[]>([])

  useEffect(()=>{
    const controller = new AbortController()
    ;(async()=>{
      try{
        setLoading(true)
        const res = await fetch(`${API}/accounts?includeArchived=false`, {signal: controller.signal})
        const json = await res.json()
        if(!res.ok) throw new Error(json?.message || 'Failed to fetch accounts')
        setRows(json.data || [])
      }catch(e:any){ setError(e.message)}
      finally{ setLoading(false)}
    })()
    return ()=> controller.abort()
  },[])

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Ledger Accounts</h2>
            <p className="text-sm text-gray-600">Pulled from `{API}/accounts`</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded bg-brand-600 px-3 py-2 text-white hover:bg-brand-700">New Account</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Total" value={rows.length} />
          <Stat label="Leaf Accounts" value={rows.filter(r=>r.isLeaf).length} />
          <Stat label="Manual Post" value={rows.filter(r=>r.allowManualPost).length} />
          <Stat label="Archived" value={rows.filter(r=>r.isArchived).length} />
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2">Manual</th>
              </tr>
            </thead>
            <tbody>
            {loading && (
              <tr><td className="px-3 py-3" colSpan={5}>Loading…</td></tr>
            )}
            {error && (
              <tr><td className="px-3 py-3 text-red-600" colSpan={5}>{error}</td></tr>
            )}
            {!loading && !error && rows.map(ac=> (
              <tr key={ac._id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{ac.accountCode}</td>
                <td className="px-3 py-2">{ac.accountName}</td>
                <td className="px-3 py-2">{ac.type}</td>
                <td className="px-3 py-2">{ac.currency}</td>
                <td className="px-3 py-2">{ac.allowManualPost? 'Yes':'No'}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  )
}

function JournalForm({onCreated}:{onCreated:(j:any)=>void}){
  const [lines, setLines] = useState([
    { account:"", debit:0, credit:0, currency:"INR", exchangeRate:1 },
    { account:"", debit:0, credit:0, currency:"INR", exchangeRate:1 },
  ])
  const [reference, setReference] = useState("")
  const totalDebit = useMemo(()=>lines.reduce((s,l)=>s+Number(l.debit||0),0),[lines])
  const totalCredit = useMemo(()=>lines.reduce((s,l)=>s+Number(l.credit||0),0),[lines])

  const isBalanced = Math.abs(totalDebit-totalCredit) < 0.01

  function update(i:number, key:string, val:any){
    setLines(prev=> prev.map((l,idx)=> idx===i? {...l,[key]:val}:l))
  }

  async function submit(){
    const payload = {
      journalDate: new Date().toISOString(),
      reference,
      lines: lines.map((l,i)=> ({
        lineNum: i+1,
        account: l.account || undefined,
        debit: Number(l.debit)||0,
        credit: Number(l.credit)||0,
        currency: l.currency,
        exchangeRate: Number(l.exchangeRate)||1,
      }))
    }
    const res = await fetch(`${API}/gl-journals`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    const json = await res.json()
    if(!res.ok) throw new Error(json?.message||'Failed to create journal')
    onCreated(json.data)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Reference</label>
          <input value={reference} onChange={e=>setReference(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Description" />
        </div>
        <div className="rounded border bg-white p-3 text-sm">
          <div className="flex items-center justify-between"><span>Total Debit</span><span className="font-semibold">{totalDebit.toFixed(2)}</span></div>
          <div className="mt-1 flex items-center justify-between"><span>Total Credit</span><span className="font-semibold">{totalCredit.toFixed(2)}</span></div>
          <div className={`mt-2 text-xs ${isBalanced? 'text-green-600':'text-red-600'}`}>{isBalanced? 'Balanced':'Not balanced'}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2">Account ID</th>
              <th className="px-2 py-2">Debit</th>
              <th className="px-2 py-2">Credit</th>
              <th className="px-2 py-2">Currency</th>
              <th className="px-2 py-2">Rate</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l,i)=> (
              <tr key={i} className="border-t">
                <td className="px-2 py-2"><input value={l.account} onChange={e=>update(i,'account',e.target.value)} placeholder="MongoID of account" className="w-56 rounded border px-2 py-1"/></td>
                <td className="px-2 py-2"><input type="number" step="0.01" value={l.debit} onChange={e=>update(i,'debit',e.target.value)} className="w-28 rounded border px-2 py-1"/></td>
                <td className="px-2 py-2"><input type="number" step="0.01" value={l.credit} onChange={e=>update(i,'credit',e.target.value)} className="w-28 rounded border px-2 py-1"/></td>
                <td className="px-2 py-2"><input value={l.currency} onChange={e=>update(i,'currency',e.target.value)} className="w-24 rounded border px-2 py-1"/></td>
                <td className="px-2 py-2"><input type="number" step="0.0001" value={l.exchangeRate} onChange={e=>update(i,'exchangeRate',e.target.value)} className="w-24 rounded border px-2 py-1"/></td>
                <td className="px-2 py-2 text-right">
                  <button onClick={()=> setLines(prev=> prev.filter((_,idx)=>idx!==i))} className="text-xs text-red-600 hover:underline">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button onClick={()=> setLines(prev=> [...prev, {account:"", debit:0, credit:0, currency:"INR", exchangeRate:1}] )} className="rounded border px-3 py-2 text-sm">Add Line</button>
        <button onClick={submit} className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Create Journal</button>
      </div>
    </div>
  )
}

function JournalsPage(){
  const [created, setCreated] = useState<any|null>(null)
  const [postResp, setPostResp] = useState<any|null>(null)
  const [error, setError] = useState<string|undefined>()

  async function postJournal(){
    if(!created?._id) return
    const res = await fetch(`${API}/gl-journals/${created._id}/post`, { method:'POST' })
    const json = await res.json()
    if(!res.ok){ setError(json?.message||'Post failed') }
    else setPostResp(json)
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">GL Journals</h2>
          <div className="text-sm text-gray-600">Create → Post → Voucher auto-created</div>
        </div>

        <JournalForm onCreated={setCreated} />

        {created && (
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Created Journal</div>
                <div className="font-mono text-sm">{created._id}</div>
              </div>
              <button onClick={postJournal} className="rounded bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700">Post Journal</button>
            </div>
          </div>
        )}

        {postResp && (
          <div className="rounded-lg border bg-white p-4">
            <div className="text-sm text-gray-500">Post Response</div>
            <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3 text-xs">{JSON.stringify(postResp,null,2)}</pre>
          </div>
        )}

        {created && (
          <SubledgerList sourceId={created._id} />
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </Shell>
  )
}

function SubledgerList({sourceId}:{sourceId:string}){
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{
    let ignore = false
    ;(async()=>{
      setLoading(true)
      const q = new URLSearchParams({ sourceId, sourceType:'JOURNAL', limit:'100'})
      const res = await fetch(`${API}/subledgers?${q.toString()}`)
      const json = await res.json()
      if(!ignore && res.ok) setRows(json.data||[])
      setLoading(false)
    })()
    return ()=> { ignore = true }
  },[sourceId])

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">GL Transactions for Journal</div>
        {loading && <div className="text-xs text-gray-500">Loading…</div>}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Amount</th>
              <th className="px-2 py-2">Currency</th>
              <th className="px-2 py-2">Local</th>
              <th className="px-2 py-2">Party</th>
              <th className="px-2 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r)=> (
              <tr key={r._id} className="border-t">
                <td className="px-2 py-2">{r.subledgerType}</td>
                <td className="px-2 py-2">{r.amount}</td>
                <td className="px-2 py-2">{r.currency}</td>
                <td className="px-2 py-2">{r.localAmount}</td>
                <td className="px-2 py-2">{r.customer||r.supplier||r.ledgerAccount||'-'}</td>
                <td className="px-2 py-2">{new Date(r.txnDate).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length===0 && !loading && (<tr><td className="px-2 py-3 text-gray-500" colSpan={6}>No subledger transactions yet</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shell><div className="grid gap-4 md:grid-cols-3"><Stat label="Accounts" value="—"/><Stat label="Journals" value="—"/><Stat label="Vouchers" value="—"/></div></Shell>} />
        <Route path="/accounts" element={<AccountsPage/>} />
        <Route path="/journals" element={<JournalsPage/>} />
      </Routes>
    </BrowserRouter>
  )
}
