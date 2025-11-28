"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchableSelectProps {
  value?: string
  onValueChange: (value: string) => void
  options: string[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "选择...",
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = React.useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    showAbove: boolean
  }>({ top: 0, left: 0, width: 0, showAbove: false })

  // 过滤选项
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options
    const query = searchQuery.toLowerCase()
    return options.filter(option => 
      option.toLowerCase().includes(query)
    )
  }, [options, searchQuery])

  // 处理选择
  const handleSelect = (option: string) => {
    onValueChange(option)
    setOpen(false)
    setSearchQuery("")
  }

  // 处理清空
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onValueChange("")
    setSearchQuery("")
    setOpen(false)
    if (inputRef.current) {
      inputRef.current.blur()
    }
  }

  // 点击外部关闭
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearchQuery("")
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  // 更新下拉框位置（fixed 定位使用视口坐标，不需要加 scrollY/scrollX）
  // 如果触底则向上展示
  const updateDropdownPosition = React.useCallback(() => {
    if (containerRef.current && open) {
      const rect = containerRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const dropdownMaxHeight = 300 // 下拉框最大高度
      const gap = 4 // 下拉框与输入框的间距
      
      // 计算可用空间
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      
      // 判断是向上还是向下展示
      // 如果下方空间不足（小于下拉框高度 + 间距），且上方空间足够，则向上展示
      const showAbove = spaceBelow < dropdownMaxHeight + gap && spaceAbove > spaceBelow
      
      if (showAbove) {
        // 向上展示：使用 bottom 定位，下拉框底部在输入框顶部上方 gap 距离
        // 确保不会超出视口顶部，如果空间不足则限制最大高度
        const availableHeight = Math.min(spaceAbove - gap, dropdownMaxHeight)
        setDropdownPosition({
          top: undefined,
          bottom: viewportHeight - rect.top + gap, // 从视口底部计算
          left: rect.left,
          width: rect.width,
          showAbove: true,
        })
      } else {
        // 向下展示：使用 top 定位，下拉框顶部在输入框下方 gap 距离
        setDropdownPosition({
          top: rect.bottom + gap,
          bottom: undefined,
          left: rect.left,
          width: rect.width,
          showAbove: false,
        })
      }
    }
  }, [open])

  // 当打开时更新位置
  React.useEffect(() => {
    if (open) {
      updateDropdownPosition()
      // 监听滚动和窗口大小变化
      const handleUpdate = () => updateDropdownPosition()
      window.addEventListener('scroll', handleUpdate, true)
      window.addEventListener('resize', handleUpdate)
      return () => {
        window.removeEventListener('scroll', handleUpdate, true)
        window.removeEventListener('resize', handleUpdate)
      }
    }
  }, [open, updateDropdownPosition])

  // 键盘导航
  const [focusedIndex, setFocusedIndex] = React.useState(-1)

  React.useEffect(() => {
    if (!open) {
      setFocusedIndex(-1)
      return
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setFocusedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          )
          break
        case "ArrowUp":
          e.preventDefault()
          setFocusedIndex(prev => prev > 0 ? prev - 1 : -1)
          break
        case "Enter":
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
            handleSelect(filteredOptions[focusedIndex])
          }
          break
        case "Escape":
          e.preventDefault()
          setOpen(false)
          setSearchQuery("")
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, filteredOptions, focusedIndex])

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "border-input data-[placeholder]:text-muted-foreground focus-visible:border-blue-500 focus-visible:ring-blue-500/20 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 min-h-[36px]",
          open && "ring-[3px] ring-blue-500/20 border-blue-500 shadow-md",
          !open && "hover:border-gray-400"
        )}
        onClick={() => !disabled && setOpen(true)}
      >
        <input
          ref={inputRef}
          type="text"
          value={open ? searchQuery : (value || "")}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setOpen(true)
            setFocusedIndex(-1)
          }}
          onFocus={() => !disabled && setOpen(true)}
          placeholder={value ? undefined : placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none placeholder:text-gray-400 text-gray-900"
        />
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center justify-center rounded-sm hover:bg-accent p-0.5 transition-colors"
              tabIndex={-1}
            >
              <XIcon className="size-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          <ChevronDownIcon 
            className={cn(
              "size-4 opacity-50 transition-transform",
              open && "rotate-180"
            )} 
          />
        </div>
      </div>

      {open && !disabled && typeof window !== 'undefined' && (
        <div 
          className="fixed z-[9999] rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg animate-in fade-in-0 zoom-in-95"
          style={{
            top: dropdownPosition.top !== undefined ? `${dropdownPosition.top}px` : undefined,
            bottom: dropdownPosition.bottom !== undefined ? `${dropdownPosition.bottom}px` : undefined,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          }}
        >
          <div className="max-h-[300px] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                未找到匹配项
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={option}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none transition-colors",
                    value === option && "bg-blue-50 text-blue-700 font-medium",
                    index === focusedIndex && !(value === option) && "bg-gray-100 text-gray-900",
                    !(value === option) && index !== focusedIndex && "hover:bg-gray-50 text-gray-700"
                  )}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <span className="flex-1">{option}</span>
                  {value === option && (
                    <span className="absolute right-2 flex size-3.5 items-center justify-center">
                      <CheckIcon className="size-4" />
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

