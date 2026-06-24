import { Appointment } from "@/lib/types/database"

export interface PlacedAppointment {
  appointment: Appointment
  left: number // 0 to 1 (representing percentage)
  width: number // 0 to 1 (representing percentage)
}

export function calculateOverlappingLayout(appointments: Appointment[]): PlacedAppointment[] {
  if (!appointments || appointments.length === 0) return []

  // 1. Sort by start time, then duration (descending)
  const sorted = [...appointments].sort((a, b) => {
    const aStart = timeToMinutes(a.appointment_time || "00:00")
    const bStart = timeToMinutes(b.appointment_time || "00:00")
    if (aStart !== bStart) return aStart - bStart
    const aDur = a.duration_minutes || 0
    const bDur = b.duration_minutes || 0
    return bDur - aDur
  })

  const placed: PlacedAppointment[] = []
  
  // 2. Group into overlapping clusters
  let currentCluster: Appointment[] = []
  let clusterEnd = -1

  for (const apt of sorted) {
    const start = timeToMinutes(apt.appointment_time || "00:00")
    const end = start + (apt.duration_minutes || 0)

    if (currentCluster.length === 0) {
      currentCluster.push(apt)
      clusterEnd = end
    } else {
      // Overlaps with cluster?
      if (start < clusterEnd) {
        currentCluster.push(apt)
        clusterEnd = Math.max(clusterEnd, end)
      } else {
        // Process current cluster
        placed.push(...processCluster(currentCluster))
        currentCluster = [apt]
        clusterEnd = end
      }
    }
  }
  
  if (currentCluster.length > 0) {
    placed.push(...processCluster(currentCluster))
  }

  return placed
}

function processCluster(cluster: Appointment[]): PlacedAppointment[] {
  const columns: Appointment[][] = []
  
  for (const apt of cluster) {
    const start = timeToMinutes(apt.appointment_time || "00:00")
    
    let placedInColumn = false
    for (const col of columns) {
      const lastInCol = col[col.length - 1]
      const lastEnd = timeToMinutes(lastInCol.appointment_time || "00:00") + (lastInCol.duration_minutes || 0)
      
      if (start >= lastEnd) {
        col.push(apt)
        placedInColumn = true
        break
      }
    }
    
    if (!placedInColumn) {
      columns.push([apt])
    }
  }

  const numColumns = columns.length
  const result: PlacedAppointment[] = []

  columns.forEach((col, colIndex) => {
    col.forEach(apt => {
      result.push({
        appointment: apt,
        left: colIndex / numColumns,
        width: 1 / numColumns
      })
    })
  })

  return result
}

function timeToMinutes(time: string): number {
  if (!time) return 0
  const [h, m] = time.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}
