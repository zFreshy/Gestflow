import React, { useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { formatCurrency } from '../../utils';

export function FinancesChart({ transactions }) {
  const chartData = useMemo(() => {
    const parseDate = (dateStr) => {
        if (!dateStr) return new Date();
        const [d, m, y] = dateStr.split('/');
        return new Date(y, m - 1, d);
    };

    // Group by day (last 7 days for simplicity on mobile)
    const grouped = transactions.reduce((acc, curr) => {
        const dateObj = parseDate(curr.date);
        const d = dateObj.getDate().toString().padStart(2, '0');
        const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const key = `${d}/${m}`;

        if (!acc[key]) {
            acc[key] = { date: key, rawDate: dateObj, ganhos: 0, gastos: 0 };
        }
        
        if (curr.type === 'income') {
            acc[key].ganhos += curr.amount;
        } else {
            acc[key].gastos += curr.amount;
        }
        return acc;
    }, {});

    const sortedData = Object.values(grouped).sort((a, b) => a.rawDate - b.rawDate).slice(-7);

    return {
        labels: sortedData.map(d => d.date),
        datasets: [
            {
                data: sortedData.map(d => d.ganhos),
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Emerald
                strokeWidth: 2
            },
            {
                data: sortedData.map(d => d.gastos),
                color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`, // Red
                strokeWidth: 2
            }
        ],
        legend: ["Ganhos", "Gastos"]
    };
  }, [transactions]);

  if (chartData.labels.length === 0) {
      return (
          <View className="h-64 items-center justify-center bg-[#18181b] rounded-2xl border border-zinc-800 p-4">
              <Text className="text-zinc-400">Sem dados para o gráfico</Text>
          </View>
      );
  }

  return (
    <View className="bg-[#18181b] rounded-2xl border border-zinc-800 p-4 shadow-sm">
        <Text className="text-lg font-bold text-white mb-4">Finanças (Últimos 7 dias)</Text>
        <BarChart
            data={chartData}
            width={Dimensions.get("window").width - 80}
            height={220}
            yAxisLabel="R$ "
            chartConfig={{
                backgroundColor: "#18181b",
                backgroundGradientFrom: "#18181b",
                backgroundGradientTo: "#18181b",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(167, 139, 250, ${opacity})`, // Purple-400
                labelColor: (opacity = 1) => `rgba(161, 161, 170, ${opacity})`, // Zinc-400
                style: {
                    borderRadius: 16
                },
                barPercentage: 0.5,
                propsForBackgroundLines: {
                    stroke: "#27272a" // Zinc-800
                }
            }}
            style={{
                marginVertical: 8,
                borderRadius: 16
            }}
            showValuesOnTopOfBars={false} // Clean look
            fromZero
        />
    </View>
  );
}