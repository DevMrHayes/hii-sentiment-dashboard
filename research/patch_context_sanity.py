from pathlib import Path

p = Path('hii-sentiment-dashboard/src/context/DashboardContext.tsx')
text = p.read_text(encoding='utf-8')
# normalize CRLF to LF first
text = text.replace('\r\n', '\n')

target_import = "  type ScoreRevision,\n} from '../engine';"
replacement_import = "  type ScoreRevision,\n  type SanityCheckItem,\n  SEEDED_SANITY_CHECKS,\n  createSanityCheckItem,\n  markSanityCheckVerified,\n} from '../engine';"

if target_import in text:
    text = text.replace(target_import, replacement_import)
    print('Replaced import')

target_interface = "  isChartExpanded: boolean;\n  setIsChartExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;\n}"
replacement_interface = "  isChartExpanded: boolean;\n  setIsChartExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;\n  sanityChecks: SanityCheckItem[];\n  addSanityCheck: (input: Omit<SanityCheckItem, 'id' | 'createdAt' | 'status'>) => void;\n  deleteSanityCheck: (id: string) => void;\n  resolveSanityCheck: (id: string, findings: string) => void;\n}"

if target_interface in text:
    text = text.replace(target_interface, replacement_interface)
    print('Replaced interface')

target_state = "  const [pinnedEventIds, setPinnedEventIds] = useState<string[]>(() => {"
replacement_state = (
    "  const [sanityChecks, setSanityChecks] = useState<SanityCheckItem[]>(() => {\n"
    "    try {\n"
    "      const saved = localStorage.getItem('hii_sentiment_sanity_checks');\n"
    "      if (saved) return JSON.parse(saved);\n"
    "    } catch {\n"
    "      // ignore\n"
    "    }\n"
    "    return SEEDED_SANITY_CHECKS;\n"
    "  });\n\n"
    "  const addSanityCheck = useCallback((input: Omit<SanityCheckItem, 'id' | 'createdAt' | 'status'>) => {\n"
    "    const item = createSanityCheckItem(input);\n"
    "    setSanityChecks((prev) => {\n"
    "      const next = [item, ...prev];\n"
    "      try {\n"
    "        localStorage.setItem('hii_sentiment_sanity_checks', JSON.stringify(next));\n"
    "      } catch {}\n"
    "      return next;\n"
    "    });\n"
    "  }, []);\n\n"
    "  const deleteSanityCheck = useCallback((id: string) => {\n"
    "    setSanityChecks((prev) => {\n"
    "      const next = prev.filter((i) => i.id !== id);\n"
    "      try {\n"
    "        localStorage.setItem('hii_sentiment_sanity_checks', JSON.stringify(next));\n"
    "      } catch {}\n"
    "      return next;\n"
    "    });\n"
    "  }, []);\n\n"
    "  const resolveSanityCheck = useCallback((id: string, findings: string) => {\n"
    "    setSanityChecks((prev) => {\n"
    "      const next = markSanityCheckVerified(prev, id, findings);\n"
    "      try {\n"
    "        localStorage.setItem('hii_sentiment_sanity_checks', JSON.stringify(next));\n"
    "      } catch {}\n"
    "      return next;\n"
    "    });\n"
    "  }, []);\n\n"
    "  const [pinnedEventIds, setPinnedEventIds] = useState<string[]>(() => {"
)

if target_state in text:
    text = text.replace(target_state, replacement_state)
    print('Replaced state')

target_value = "        isChartExpanded,\n        setIsChartExpanded,\n      }"
replacement_value = (
    "        isChartExpanded,\n"
    "        setIsChartExpanded,\n"
    "        sanityChecks,\n"
    "        addSanityCheck,\n"
    "        deleteSanityCheck,\n"
    "        resolveSanityCheck,\n"
    "      }"
)

if target_value in text:
    text = text.replace(target_value, replacement_value)
    print('Replaced value')

p.write_text(text, encoding='utf-8')
print('Finished updating DashboardContext.tsx')
