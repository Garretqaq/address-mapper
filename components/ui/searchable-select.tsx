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

  // 处理选择（使用 useCallback 优化）
  const handleSelect = React.useCallback((option: string) => {
    onValueChange(option)
    setOpen(false)
    setSearchQuery("")
  }, [onValueChange])

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

  // 当打开时更新位置（使用防抖优化性能）
  React.useEffect(() => {
    if (open) {
      updateDropdownPosition()
      
      // 防抖函数，减少频繁更新
      let timeoutId: NodeJS.Timeout | null = null
      const debouncedUpdate = () => {
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          updateDropdownPosition()
        }, 16) // 约 60fps，平衡性能和响应速度
      }
      
      // 监听滚动和窗口大小变化
      window.addEventListener('scroll', debouncedUpdate, true)
      window.addEventListener('resize', debouncedUpdate)
      
      return () => {
        if (timeoutId) clearTimeout(timeoutId)
        window.removeEventListener('scroll', debouncedUpdate, true)
        window.removeEventListener('resize', debouncedUpdate)
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
  }, [open, filteredOptions, focusedIndex, handleSelect])

  // 从 className 中提取高度和宽度相关的类
  const hasHeight = className?.includes('h-');
  const hasWidth = className?.includes('w-');
  const hasMinWidth = className?.includes('min-w-');
  const hasMaxWidth = className?.includes('max-w-');
  
  // 分离样式类：宽度和高度类应用到外层，其他类应用到内层
  const widthHeightClasses = className?.split(' ').filter(cls => 
    cls.includes('w-') || cls.includes('h-') || cls.includes('min-w-') || cls.includes('max-w-')
  ).join(' ') || '';
  
  const otherClasses = className?.split(' ').filter(cls => 
    !cls.includes('w-') && !cls.includes('h-') && !cls.includes('min-w-') && !cls.includes('max-w-')
  ).join(' ') || '';
  
  return (
    <div ref={containerRef} className={cn("relative", widthHeightClasses)}>
      <div
        className={cn(
          "border-input data-[placeholder]:text-muted-foreground focus-visible:border-blue-500 focus-visible:ring-blue-500/20 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex items-center gap-1 rounded-md border px-2 py-1 text-xs shadow-xs transition-all outline-none focus-visible:ring-[3px]",
          !hasHeight && "min-h-[28px]",
          !hasWidth && !hasMinWidth && !hasMaxWidth && "w-full",
          // 正常状态
          !disabled && "bg-white dark:bg-input/30 dark:hover:bg-input/50",
          // 禁用状态
          disabled && "bg-gray-100 border-gray-300 cursor-not-allowed",
          // 打开状态
          open && !disabled && "ring-[3px] ring-blue-500/20 border-blue-500 shadow-md",
          // 悬停状态（仅非禁用）
          !open && !disabled && "hover:border-gray-400",
          otherClasses
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
          className={cn(
            "flex-1 min-w-0 bg-transparent outline-none placeholder:text-gray-400 text-xs",
            disabled ? "text-gray-400 cursor-not-allowed" : "text-gray-900"
          )}
        />
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center justify-center rounded-sm hover:bg-gray-200 p-0.5 transition-colors"
              tabIndex={-1}
              title="清空"
              onMouseDown={(e) => e.preventDefault()}
            >
              <XIcon className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700" />
            </button>
          )}
          <ChevronDownIcon 
            className={cn(
              "w-3.5 h-3.5 transition-transform flex-shrink-0",
              disabled ? "text-gray-400" : "text-gray-500",
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
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                未找到匹配项
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <div
                  key={option}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1 pr-6 pl-2 text-xs outline-none transition-colors",
                    value === option && "bg-blue-50 text-blue-700 font-medium",
                    index === focusedIndex && !(value === option) && "bg-gray-100 text-gray-900",
                    !(value === option) && index !== focusedIndex && "hover:bg-gray-50 text-gray-700"
                  )}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <span className="flex-1">{option}</span>
                  {value === option && (
                    <span className="absolute right-2 flex size-3 items-center justify-center">
                      <CheckIcon className="size-3" />
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

