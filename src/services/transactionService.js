import { supabase } from '../lib/supabase';

export const transactionService = {
  async getAll(userId, page = 0, pageSize = 50) {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    const { data, error, count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .order('date', { ascending: false })
      .range(start, end);
    
    if (error) throw error;
    return { data, count, hasMore: start + data.length < count };
  },

  async create(transaction) {
    const { data, error } = await supabase
      .from('transactions')
      .insert([transaction])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  async deleteMany(ids) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', ids);
    
    if (error) throw error;
    return true;
  },

  async createMany(transactions) {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactions)
      .select();
    
    if (error) throw error;
    return data;
  },

  async checkExistingBakeryIncome(userId, dates) {
    const { data, error } = await supabase
        .from('transactions')
        .select('date')
        .eq('user_id', userId)
        .in('date', dates)
        .like('description', 'Lucro Padaria%');
        
    if (error) throw error;
    return data;
  },

  async finalizeRecurrence(userId, description, endDate) {
    // 1. Update all existing transactions with same description and type='expense'
    // to have active=false and end_date=endDate
    const { error } = await supabase
        .from('transactions')
        .update({ 
            active: false,
            end_date: endDate
        })
        .eq('user_id', userId)
        .eq('description', description)
        .eq('type', 'expense')
        .eq('expense_type', 'fixed');

    if (error) throw error;
    return true;
  },

  async reactivateRecurrence(userId, description) {
    // 1. Update all existing transactions with same description and type='expense'
    // to have active=true and end_date=null
    const { error } = await supabase
        .from('transactions')
        .update({ 
            active: true,
            end_date: null
        })
        .eq('user_id', userId)
        .eq('description', description)
        .eq('type', 'expense')
        .eq('expense_type', 'fixed');

    if (error) throw error;
    return true;
  }
};