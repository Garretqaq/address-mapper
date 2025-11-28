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

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg animate-in fade-in-0 zoom-in-95">
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

