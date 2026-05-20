'use client'

import { useEffect, useState } from 'react'
import { Shield, Loader2, AlertCircle, Lock, Unlock, X } from 'lucide-react'
import { api, Department, DepartmentAccessMap } from '@/lib/api'

interface DepartmentAccessPickerProps {
  value: DepartmentAccessMap
  onChange: (next: DepartmentAccessMap) => void
  disabled?: boolean
}

/**
 * DepartmentAccessPicker
 * 
 * Renders an interactive matrix grid:
 * - Rows: Departments
 * - Columns: Clearance levels represented as horizontal pill badges.
 * - Clicking a pill badge pre-selects that clearance level and enables access for the department.
 * - Public department is locked at Rank 1 (Public) and cannot be removed.
 */
export default function DepartmentAccessPicker({
  value,
  onChange,
  disabled = false,
}: DepartmentAccessPickerProps) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch departments on mount
  useEffect(() => {
    setLoading(true)
    setError(null)
    api
      .listDepartments()
      .then((depts) => {
        setDepartments(depts)

        // Pre-populate the Public department with ranking 1 if not already set.
        const pub = depts.find((d) => d.name === 'Public')
        if (pub && value[pub.uuid] === undefined) {
          onChange({ ...value, [pub.uuid]: 1 })
        }
      })
      .catch(() => setError('Failed to load departments. Please reload.'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isPublic = (dept: Department) => dept.name === 'Public'

  const isSelected = (dept: Department) => value[dept.uuid] !== undefined

  const handleSelectLevel = (dept: Department, ranking: number) => {
    if (disabled) return
    // If it's Public, they cannot change the level or remove it (it must stay at ranking 1)
    if (isPublic(dept)) return

    onChange({
      ...value,
      [dept.uuid]: ranking,
    })
  }

  const handleRemoveDepartment = (dept: Department) => {
    if (disabled || isPublic(dept)) return
    const next = { ...value }
    delete next[dept.uuid]
    onChange(next)
  }

  const getBadgeStyle = (ranking: number, isCurrentSelection: boolean) => {
    if (!isCurrentSelection) {
      return 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
    }
    // Highlighting based on clearance level
    if (ranking <= 1) return 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300 ring-offset-1'
    if (ranking === 2) return 'bg-sky-600 text-white border-sky-600 ring-2 ring-sky-300 ring-offset-1'
    if (ranking === 3) return 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300 ring-offset-1'
    if (ranking === 4) return 'bg-orange-600 text-white border-orange-600 ring-2 ring-orange-300 ring-offset-1'
    return 'bg-red-600 text-white border-red-600 ring-2 ring-red-300 ring-offset-1'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-slate-400 border border-slate-100 bg-white rounded-xl">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        <span className="text-sm font-medium">Loading security matrix...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-semibold">Security configuration error</p>
          <p className="text-xs mt-0.5">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-500" />
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Clearance Classification Matrix</h4>
            <p className="text-xs text-slate-500">Configure who is authorized to view vector search results.</p>
          </div>
        </div>
      </div>

      <div className="border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-sm">
        <div className="min-w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 table-fixed">
            <thead className="bg-slate-50/70">
              <tr>
                <th scope="col" className="w-[180px] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Department
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  Clearance Requirement
                </th>
                <th scope="col" className="w-[80px] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {departments.map((dept) => {
                const selected = isSelected(dept)
                const pub = isPublic(dept)
                const activeRanking = value[dept.uuid]
                // Sort levels by ranking (lowest first)
                const levels = dept.permission_levels.slice().sort((a, b) => a.ranking - b.ranking)

                return (
                  <tr
                    key={dept.uuid}
                    className={`transition-colors ${selected ? 'bg-indigo-50/20' : 'hover:bg-slate-50/40'}`}
                  >
                    {/* Department Header */}
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-center gap-2">
                        {pub ? (
                          <Lock className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : selected ? (
                          <Unlock className="w-4 h-4 text-indigo-400 shrink-0" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-dashed border-slate-300 shrink-0" />
                        )}
                        <span className={`text-sm font-semibold truncate ${selected ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                          {dept.name}
                        </span>
                      </div>
                    </td>

                    {/* Level Pills Matrix */}
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-wrap gap-2">
                        {levels.map((level) => {
                          const isCurrent = selected && activeRanking === level.ranking
                          const isButtonDisabled = disabled || (pub && level.ranking !== 1)

                          return (
                            <button
                              key={level.id}
                              type="button"
                              disabled={isButtonDisabled}
                              onClick={() => handleSelectLevel(dept, level.ranking)}
                              className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer select-none ${getBadgeStyle(
                                level.ranking,
                                isCurrent
                              )} ${isButtonDisabled ? 'opacity-55 cursor-not-allowed' : ''}`}
                            >
                              {level.name}
                            </button>
                          )
                        })}

                        {levels.length === 0 && (
                          <span className="text-xs italic text-slate-400">No clearance levels defined</span>
                        )}
                      </div>
                    </td>

                    {/* Action / Active State */}
                    <td className="px-4 py-3.5 align-middle text-center">
                      {pub ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Locked
                        </span>
                      ) : selected ? (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleRemoveDepartment(dept)}
                          className="p-1 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg transition-colors border border-transparent hover:border-red-200 shrink-0"
                          title="Revoke department access"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 italic">None</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
